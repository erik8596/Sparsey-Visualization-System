import torch
import numpy as np
from src.core.model.wandb.wandb_facade import WandBFacade
from typing import Tuple, Dict, Any

class WeightedConnectionsParser:
    """Parser for weighted connections data from WandB, based on MAC-level connections."""

    def __init__(self, wbf: WandBFacade):
        self.mconf = wbf.mconf
        if not self.mconf or not self.mconf.layers or not self.mconf.input_dimensions:
            print("Warning: ModelConfig not fully populated in WandBFacade. Attempting to fetch.")
            wbf.get_processed_model_config()
            self.mconf = wbf.mconf
            if not self.mconf or not self.mconf.layers or not self.mconf.input_dimensions:
                raise ValueError("Failed to load model configuration (layers or input dims) from WandB.")

        if not self.mconf.weighted_connections:
            print("Warning: Weighted connections not found in ModelConfig. Attempting to fetch.")
            wbf.find_weight_artifacts()
            self.weighted_connections = self.mconf.weighted_connections
            if not self.weighted_connections:
                print("Warning: Failed to fetch weighted connections.")
                self.weighted_connections = {}
        else:
            self.weighted_connections = self.mconf.weighted_connections

        # Store layer dimensions, including input layer (layer 0)
        self._layer_dims = self._extract_layer_dimensions()

    def _extract_layer_dimensions(self) -> Dict[int, Dict[str, Any]]:
        """Extracts essential dimensions for each layer (0-based index) from model config."""
        dims = {}
        if not self.mconf:
            raise ValueError("ModelConfig (mconf) is not initialized.")

        # --- Layer 0: Input Layer --- 
        input_dims = self.mconf.input_dimensions or {}
        input_width = input_dims.get("width", 0)
        input_height = input_dims.get("height", 0)
        input_total_neurons = input_width * input_height
        if input_total_neurons <= 0:
            print("Warning: Input dimensions not found or invalid in ModelConfig.")

        dims[0] = {
            "num_macs": input_total_neurons, # Treat each input pixel as a "MAC"
            "cms_per_mac": 1,
            "neurons_per_cm": 1,
            "neurons_per_mac": 1,
            "total_neurons": input_total_neurons,
            # receptive_field_num_macs is inferred later in parse()
        }

        # --- Layers > 0 --- 
        if not self.mconf.layers:
            print("Warning: No layers found in mconf.layers")
            return dims # Return dims with only layer 0
        
        num_layers = len(self.mconf.layers)
        for i in range(1, num_layers + 1):
            layer_key = f"layer_{i}"
            layer_params = self.mconf.layers.get(layer_key, {}).get("params", {})

            # Extract only necessary dimensions
            num_macs = layer_params.get("num_macs", 0)
            cms_per_mac = layer_params.get("num_cms_per_mac", 0)
            neurons_per_cm = layer_params.get("num_neurons_per_cm", 0)

            valid_dims = (isinstance(num_macs, int) and num_macs > 0 and
                          isinstance(cms_per_mac, int) and cms_per_mac > 0 and
                          isinstance(neurons_per_cm, int) and neurons_per_cm > 0)

            if not valid_dims:
                print(f"Warning: Missing or invalid base dimensions for {layer_key}. Found: num_macs={num_macs}, cms_per_mac={cms_per_mac}, neurons_per_cm={neurons_per_cm}. Params: {layer_params}")
                total_neurons = 0
                neurons_per_mac = 0
            else:
                neurons_per_mac = cms_per_mac * neurons_per_cm
                total_neurons = num_macs * neurons_per_mac

            dims[i] = {
                "num_macs": num_macs,
                "cms_per_mac": cms_per_mac,
                "neurons_per_cm": neurons_per_cm,
                "neurons_per_mac": neurons_per_mac,
                "total_neurons": total_neurons,
                # receptive_field_num_macs is inferred later in parse()
            }
            if total_neurons <= 0 and valid_dims: # Only warn if dims looked valid initially
                print(f"Warning: Calculated total neurons for layer {i} is {total_neurons}. Check config.")

        return dims

    def _get_layer_dims(self, layer_index: int) -> Dict[str, int]:
        """Gets the dimensions for a specific layer index (0-based)."""
        if layer_index not in self._layer_dims:
            raise ValueError(f"Dimensions not found for layer {layer_index}. Available: {list(self._layer_dims.keys())}")
        # Allow returning dims even if total_neurons is 0, validation happens in parse
        return self._layer_dims[layer_index]

    def _get_cm_neuron_coords_in_mac(self, flat_index_in_mac: int, layer_index: int) -> Tuple[int, int]:
        """Converts a flat neuron index *within* a MAC to (cm, neuron) indices."""
        if layer_index == 0:
             raise ValueError("Cannot get CM/Neuron coordinates for input layer (layer 0).")

        dims = self._get_layer_dims(layer_index)
        neurons_per_cm = dims.get("neurons_per_cm") # Use .get for safety
        neurons_per_mac = dims.get("neurons_per_mac")

        if not neurons_per_cm or neurons_per_cm <= 0:
            raise ValueError(f"Invalid dimensions for layer {layer_index}: neurons_per_cm={neurons_per_cm}")
        if not neurons_per_mac:
             raise ValueError(f"Invalid dimensions for layer {layer_index}: neurons_per_mac={neurons_per_mac}")

        if flat_index_in_mac < 0 or flat_index_in_mac >= neurons_per_mac:
             raise IndexError(f"Flat index within MAC {flat_index_in_mac} out of bounds (0-{neurons_per_mac-1}) for layer {layer_index}.")

        cm_index = flat_index_in_mac // neurons_per_cm
        neuron_index = flat_index_in_mac % neurons_per_cm

        return cm_index, neuron_index

    def parse(self, step: int) -> Dict[str, Any]:
        """
        Parses weighted connections for a specific step based on MAC-level connections.
        Infers receptive_field_num_macs from the connections tensor shape.

        Args:
            step (int): The simulation step for which to parse weights.
            
        Returns:
            Dict[str, Any]: A nested dictionary representing the parsed connections.
                            Format: { "layer_L": { "mac_M": { "cm_C": { "neuron_N":
                                      { "sources": [ {"coords": (src_mac_idx, src_cm, src_n | src_mac_idx), "weight": w}, ... ] }
                                    }}}}
        Raises:
            ValueError: If data is missing, inconsistent, or dimensions are invalid.
            IndexError: If tensor indices go out of bounds during processing.
        """
        if step not in self.weighted_connections:
            available_steps = list(self.weighted_connections.keys())
            raise ValueError(f"No weighted connections found for step {step}. Available steps: {available_steps}")

        step_data = self.weighted_connections[step]
        if not isinstance(step_data, dict):
             raise ValueError(f"Expected dict for step {step} data, got {type(step_data)}")

        parsed_structure: Dict[str, Any] = {}
        total_connections_parsed = 0

        # Iterate through layers defined in the step_data (e.g., 'layer_1', 'layer_2')
        for layer_key, layer_connection_data in step_data.items():
            if not layer_key.startswith("layer_"):
                print(f"Warning: Skipping unexpected key '{layer_key}' in step {step} data.")
                continue

            try:
                dest_layer_index = int(layer_key.split('_')[1])
            except (IndexError, ValueError):
                print(f"Warning: Could not parse layer index from key '{layer_key}'. Skipping.")
                continue

            if not isinstance(layer_connection_data, dict):
                 print(f"Warning: Expected dict for {layer_key} data, got {type(layer_connection_data)}. Skipping layer.")
                 continue

            prev_layer_index = dest_layer_index - 1
            if prev_layer_index < 0:
                print(f"Warning: Cannot parse connections into layer 0 ({layer_key}). Skipping.")
                continue

            weights_tensor = layer_connection_data.get('weights')
            connections_tensor = layer_connection_data.get('connections')

            if weights_tensor is None or connections_tensor is None:
                print(f"Warning: Missing 'weights' or 'connections' in {layer_key} for step {step}. Skipping layer.")
                continue

            # Convert to numpy
            if isinstance(weights_tensor, torch.Tensor): 
                weights_tensor = weights_tensor.cpu().numpy()
            if isinstance(connections_tensor, torch.Tensor): 
                connections_tensor = connections_tensor.cpu().numpy()

            # Handle case where loaded data might be a list
            if isinstance(weights_tensor, list):
                try:
                    weights_tensor = np.array(weights_tensor)
                    print(f"Note: Converted weights_tensor from list to numpy array for {layer_key}.")
                except Exception as e:
                    print(f"Warning: Failed to convert weights_tensor list to numpy array for {layer_key}: {e}. Skipping layer.")
                    continue
            if isinstance(connections_tensor, list):
                try:
                    connections_tensor = np.array(connections_tensor)
                    print(f"Note: Converted connections_tensor from list to numpy array for {layer_key}.")
                except Exception as e:
                    print(f"Warning: Failed to convert connections_tensor list to numpy array for {layer_key}: {e}. Skipping layer.")
                    continue

            # --- Dimension and Shape Validation --- 
            try:
                dest_dims = self._get_layer_dims(dest_layer_index)
                prev_dims = self._get_layer_dims(prev_layer_index)
            except ValueError as e:
                 print(f"Error getting dimensions for {layer_key} or previous layer {prev_layer_index}: {e}. Skipping layer.")
                 continue

            # Check if base dimensions seem valid 
            if dest_dims.get("total_neurons", 0) <= 0 or prev_dims.get("total_neurons", 0) <= 0:
                 print(f"Warning: Invalid base dimensions calculated for {layer_key} (neurons: {dest_dims.get('total_neurons')}) or prev layer {prev_layer_index} (neurons: {prev_dims.get('total_neurons')}). Skipping layer.")
                 continue
            if dest_dims.get("neurons_per_mac", 0) <= 0 or prev_dims.get("neurons_per_mac", 0) <= 0:
                print(f"Warning: Invalid neurons_per_mac for {layer_key} ({dest_dims.get('neurons_per_mac')}) or prev layer {prev_layer_index} ({prev_dims.get('neurons_per_mac')}). Skipping layer.")
                continue
            
            # Validate tensor dimensions before inferring receptive_field_num_macs
            if len(weights_tensor.shape) != 3:
                print(f"Warning: Expected 3D weights tensor for {layer_key}, got {weights_tensor.shape}. Skipping layer.")
                continue
            if len(connections_tensor.shape) != 2:
                 print(f"Warning: Expected 2D connections tensor for {layer_key}, got {connections_tensor.shape}. Skipping layer.")
                 continue
                 
            # Infer receptive_field_num_macs from connections tensor
            receptive_field_num_macs = connections_tensor.shape[1]
            if receptive_field_num_macs <= 0:
                 print(f"Warning: Inferred receptive_field_num_macs is {receptive_field_num_macs} for {layer_key}. Skipping layer.")
                 continue
                 
            # Expected shapes based on dimensions and inferred rf_macs
            exp_conns_shape = (dest_dims["num_macs"],
                               receptive_field_num_macs)
            exp_weights_shape = (dest_dims["num_macs"],
                                 receptive_field_num_macs * prev_dims["neurons_per_mac"],
                                 dest_dims["neurons_per_mac"])

            # Validate tensor shapes against expectations
            if connections_tensor.shape != exp_conns_shape:
                print(f"Warning: Connections tensor shape mismatch for {layer_key}. Expected {exp_conns_shape}, Got {connections_tensor.shape}. Skipping layer.")
                continue
            if weights_tensor.shape != exp_weights_shape:
                print(f"Warning: Weight tensor shape mismatch for {layer_key}. Expected {exp_weights_shape}, Got {weights_tensor.shape}. Skipping layer.")
                continue
            # --- End Validation --- 

            parsed_structure[layer_key] = {}
            layer_connections_parsed = 0

            # Iterate through Destination MACs
            for dest_mac_idx in range(dest_dims["num_macs"]):
                mac_key = f"mac_{dest_mac_idx}"
                parsed_structure[layer_key][mac_key] = {}

                # Iterate through Destination Neurons within this MAC
                for dest_neuron_in_mac_flat_idx in range(dest_dims["neurons_per_mac"]):
                    try:
                        dest_cm, dest_neuron = self._get_cm_neuron_coords_in_mac(dest_neuron_in_mac_flat_idx, dest_layer_index)
                    except (ValueError, IndexError) as e:
                         print(f"Error getting coords for dest neuron {dest_neuron_in_mac_flat_idx} in {mac_key}: {e}. Skipping neuron.")
                         continue

                    cm_key = f"cm_{dest_cm}"
                    neuron_key = f"neuron_{dest_neuron}"
                    if cm_key not in parsed_structure[layer_key][mac_key]:
                        parsed_structure[layer_key][mac_key][cm_key] = {}
                    
                    parsed_structure[layer_key][mac_key][cm_key][neuron_key] = {"sources": []} # Initialize sources list
                    sources_list = parsed_structure[layer_key][mac_key][cm_key][neuron_key]["sources"]

                    # Iterate through Source MAC connections in the Receptive Field
                    for rf_mac_idx in range(receptive_field_num_macs): # Use inferred value
                        src_mac_flat_idx = int(connections_tensor[dest_mac_idx, rf_mac_idx])

                        if src_mac_flat_idx < 0:
                            continue # Skip padding/invalid indices
                        
                        # Validate source MAC index against previous layer's total MACs
                        if src_mac_flat_idx >= prev_dims["num_macs"]:
                            #  print(f"Warning: Source MAC index {src_mac_flat_idx} out of bounds for layer {prev_layer_index} (num_macs: {prev_dims['num_macs']}). Dest: {layer_key}/{mac_key}. Skipping RF entry.")
                             continue

                        # Iterate through Source Neurons within the connected Source MAC
                        for src_neuron_in_mac_flat_idx in range(prev_dims["neurons_per_mac"]):
                            # Calculate index into the second dimension of the weights tensor
                            src_neuron_rf_flat_idx = rf_mac_idx * prev_dims["neurons_per_mac"] + src_neuron_in_mac_flat_idx
                            
                            # Index bounds check for weights tensor (safer)
                            if src_neuron_rf_flat_idx >= weights_tensor.shape[1] or \
                               dest_neuron_in_mac_flat_idx >= weights_tensor.shape[2]:
                                 print(f"Error: Calculated weights index ({dest_mac_idx}, {src_neuron_rf_flat_idx}, {dest_neuron_in_mac_flat_idx}) out of bounds for shape {weights_tensor.shape}. Skipping.")
                                 continue
                                 
                            # Get the weight value
                            scalar_weight = weights_tensor[dest_mac_idx, src_neuron_rf_flat_idx, dest_neuron_in_mac_flat_idx]

                            # --- Filter by threshold --- 
                            # if abs(scalar_weight) <= weight_threshold:
                            #     continue # Skip weights below threshold
                            
                            layer_connections_parsed += 1 # Count this connection

                            # Determine source coordinates
                            try:
                                if prev_layer_index == 0:
                                    source_coords = (src_mac_flat_idx,) # Input layer source coord is just its flat index
                                else:
                                    src_cm, src_neuron = self._get_cm_neuron_coords_in_mac(src_neuron_in_mac_flat_idx, prev_layer_index)
                                    source_coords = (src_mac_flat_idx, src_cm, src_neuron)
                            except (ValueError, IndexError) as e:
                                print(f"Error getting coords for source neuron {src_neuron_in_mac_flat_idx} in source MAC {src_mac_flat_idx} (Layer {prev_layer_index}): {e}. Skipping source.")
                                continue

                            sources_list.append({
                                "sparsey_coords": source_coords,
                                "weight": float(scalar_weight)
                            })
            # End loop through layers in step_data

            # Clean up empty entries if desired (optional)
            # ... add logic here to remove neurons/cms/macs with no sources ...
            
            print(f"Parsed {layer_connections_parsed} connections for {layer_key} at step {step}.")
            total_connections_parsed += layer_connections_parsed

        print(f"Finished parsing step {step}. Total connections parsed: {total_connections_parsed}.")
        return parsed_structure
    
    def threshold_parse(self, step: int, weight_threshold: float = 0.0) -> Dict[str, Any]:
        """
        Optimized parsing of weighted connections using NumPy vectorization.
        Only includes connections with weights > threshold (absolute value).

        Args:
            step (int): The simulation step for which to parse weights.
            weight_threshold (float): Minimum absolute weight value to include.

        Returns:
            Dict[str, Any]: Parsed connections, similar format to parse().
        """
        if step not in self.weighted_connections:
            available_steps = list(self.weighted_connections.keys())
            raise ValueError(f"No weighted connections found for step {step}. Available steps: {available_steps}")

        step_data = self.weighted_connections[step]
        if not isinstance(step_data, dict):
             raise ValueError(f"Expected dict for step {step} data, got {type(step_data)}")

        parsed_structure: Dict[str, Any] = {}
        total_connections_parsed = 0

        for layer_key, layer_connection_data in step_data.items():
            # --- Initial checks and data loading (similar to parse method) ---
            if not layer_key.startswith("layer_"): 
                continue
            try: 
                dest_layer_index = int(layer_key.split('_')[1])
            except Exception: 
                continue
            if not isinstance(layer_connection_data, dict): 
                continue
            prev_layer_index = dest_layer_index - 1
            if prev_layer_index < 0: 
                continue

            weights_tensor = layer_connection_data.get('weights')
            connections_tensor = layer_connection_data.get('connections')
            if weights_tensor is None or connections_tensor is None: 
                continue

            # Convert to numpy
            if isinstance(weights_tensor, torch.Tensor):
                weights_tensor = weights_tensor.cpu().numpy()
            if isinstance(connections_tensor, torch.Tensor): 
                connections_tensor = connections_tensor.cpu().numpy()

            # Handle case where loaded data might be a list
            if isinstance(weights_tensor, list):
                try:
                    weights_tensor = np.array(weights_tensor)
                    print(f"Note: Converted weights_tensor from list to numpy array for {layer_key}.")
                except Exception as e:
                    print(f"Warning: Failed to convert weights_tensor list to numpy array for {layer_key}: {e}. Skipping layer.")
                    continue
            if isinstance(connections_tensor, list):
                try:
                    connections_tensor = np.array(connections_tensor)
                    print(f"Note: Converted connections_tensor from list to numpy array for {layer_key}.")
                except Exception as e:
                    print(f"Warning: Failed to convert connections_tensor list to numpy array for {layer_key}: {e}. Skipping layer.")
                    continue

            # --- Dimension and Shape Validation (similar to parse method) ---
            try:
                dest_dims = self._get_layer_dims(dest_layer_index)
                prev_dims = self._get_layer_dims(prev_layer_index)
            except ValueError as e:
                 print(f"Error getting dimensions for {layer_key} or previous layer {prev_layer_index}: {e}. Skipping layer.")
                 continue

            if dest_dims.get("total_neurons", 0) <= 0 or prev_dims.get("total_neurons", 0) <= 0 or \
               dest_dims.get("neurons_per_mac", 0) <= 0 or prev_dims.get("neurons_per_mac", 0) <= 0:
                 print(f"Warning: Invalid base dimensions for {layer_key} or prev layer {prev_layer_index}. Skipping layer.")
                 continue
            
            if len(weights_tensor.shape) != 3 or len(connections_tensor.shape) != 2:
                 print(f"Warning: Unexpected tensor dimensions for {layer_key}. Weights: {weights_tensor.shape}, Conns: {connections_tensor.shape}. Skipping.")
                 continue
                 
            receptive_field_num_macs = connections_tensor.shape[1]
            if receptive_field_num_macs <= 0: 
                continue

            exp_conns_shape = (dest_dims["num_macs"], receptive_field_num_macs)
            exp_weights_shape = (dest_dims["num_macs"],
                                 receptive_field_num_macs * prev_dims["neurons_per_mac"],
                                 dest_dims["neurons_per_mac"])

            if connections_tensor.shape != exp_conns_shape or weights_tensor.shape != exp_weights_shape:
                print(f"Warning: Tensor shape mismatch for {layer_key}. Conns: {connections_tensor.shape} vs {exp_conns_shape}, Weights: {weights_tensor.shape} vs {exp_weights_shape}. Skipping.")
                continue
            # --- End Validation ---

            layer_connections_parsed = 0
            parsed_structure[layer_key] = {}

            # --- Vectorized Processing ---
            
            # 1. Find indices of weights above threshold
            #    indices is a tuple of arrays: (dest_mac_indices, src_neuron_rf_flat_indices, dest_neuron_in_mac_flat_indices)
            indices = np.where(np.abs(weights_tensor) > weight_threshold)
            
            # Check if any weights met the threshold
            if len(indices[0]) == 0:
                print(f"No connections found above threshold {weight_threshold} for {layer_key}.")
                continue # Skip to next layer if no connections found

            # Extract the index arrays
            dest_mac_idx_arr = indices[0]
            src_neuron_rf_flat_idx_arr = indices[1]
            dest_neuron_in_mac_flat_idx_arr = indices[2]

            # 2. Get the corresponding weight values
            scalar_weights_arr = weights_tensor[indices]

            # 3. Calculate receptive field MAC index (rf_mac_idx) from src_neuron_rf_flat_idx
            #    Need prev_dims['neurons_per_mac'] - handle potential division by zero if dims were bad (should be caught earlier)
            prev_neurons_per_mac = prev_dims['neurons_per_mac']
            rf_mac_idx_arr = src_neuron_rf_flat_idx_arr // prev_neurons_per_mac

            # 4. Lookup the actual source MAC flat index using connections_tensor
            #    connections_tensor shape: (dest_num_macs, receptive_field_num_macs)
            #    We need connections_tensor[dest_mac_idx_arr[i], rf_mac_idx_arr[i]] for each i
            #    This uses advanced indexing in NumPy
            try:
                 src_mac_flat_idx_arr = connections_tensor[dest_mac_idx_arr, rf_mac_idx_arr]
            except IndexError as e:
                 print(f"Error during advanced indexing lookup in connections_tensor for {layer_key}: {e}. Max dest_mac={np.max(dest_mac_idx_arr)}, Max rf_mac={np.max(rf_mac_idx_arr)}, Shape={connections_tensor.shape}. Skipping layer.")
                 continue


            # 5. Calculate source neuron flat index within its MAC
            src_neuron_in_mac_flat_idx_arr = src_neuron_rf_flat_idx_arr % prev_neurons_per_mac

            # --- Structure the Output ---
            # Now iterate through the found connections (which is much smaller than iterating all possibilities)
            for i in range(len(dest_mac_idx_arr)):
                dest_mac_idx = dest_mac_idx_arr[i]
                dest_neuron_in_mac_flat_idx = dest_neuron_in_mac_flat_idx_arr[i]
                src_mac_flat_idx = int(src_mac_flat_idx_arr[i]) # Convert numpy int potentially
                src_neuron_in_mac_flat_idx = src_neuron_in_mac_flat_idx_arr[i]
                scalar_weight = scalar_weights_arr[i]

                # Skip invalid source MAC indices derived from connections_tensor
                if src_mac_flat_idx < 0: 
                    continue
                if src_mac_flat_idx >= prev_dims["num_macs"]: 
                    continue # Bounds check

                # Calculate destination coordinates
                try:
                    dest_cm, dest_neuron = self._get_cm_neuron_coords_in_mac(dest_neuron_in_mac_flat_idx, dest_layer_index)
                except (ValueError, IndexError): 
                    continue # Skip if error

                # Calculate source coordinates
                try:
                    if prev_layer_index == 0:
                        source_coords = (src_mac_flat_idx,)
                    else:
                        src_cm, src_neuron = self._get_cm_neuron_coords_in_mac(src_neuron_in_mac_flat_idx, prev_layer_index)
                        source_coords = (src_mac_flat_idx, src_cm, src_neuron)
                except (ValueError, IndexError): 
                    continue # Skip if error

                # Add to nested structure
                mac_key = f"mac_{dest_mac_idx}"
                cm_key = f"cm_{dest_cm}"
                neuron_key = f"neuron_{dest_neuron}"

                if mac_key not in parsed_structure[layer_key]: 
                    parsed_structure[layer_key][mac_key] = {}
                if cm_key not in parsed_structure[layer_key][mac_key]: 
                    parsed_structure[layer_key][mac_key][cm_key] = {}
                if neuron_key not in parsed_structure[layer_key][mac_key][cm_key]: 
                    parsed_structure[layer_key][mac_key][cm_key][neuron_key] = {"sources": []}

                parsed_structure[layer_key][mac_key][cm_key][neuron_key]["sources"].append({
                    "sparsey_coords": source_coords,
                    "weight": float(scalar_weight)
                })
                layer_connections_parsed += 1
            # --- End Structuring Output ---

            print(f"Parsed {layer_connections_parsed} connections for {layer_key} at step {step} (threshold > {weight_threshold}).")
            total_connections_parsed += layer_connections_parsed

        print(f"Finished parsing step {step}. Total connections parsed: {total_connections_parsed} (threshold > {weight_threshold}).")
        return parsed_structure
    
    
    