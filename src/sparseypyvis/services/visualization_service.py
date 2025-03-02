from typing import Dict, List, Any
from src.sparseypyvis.services.grid_utils import hex_grid, place_cms_in_mac, place_neurons_in_cm

class VisualizationService:
    """Service for processing and transforming model data into visualization-ready format."""
    
    @staticmethod
    def process_visualization_data(model_config: Dict[str, Any], mac_activations: Dict[str, Dict[int, int]]) -> Dict[str, Any]:
        """
        Process model configuration and MAC activations into a format suitable for visualization.
        Handles placement of MACs, CMs, and neurons in a 3D space.
        
        Args:
            model_config: Dictionary containing layer configurations
            mac_activations: Dictionary of MAC activation states by layer
            
        Returns:
            Dictionary containing:
                - layers: List of positioned components (MACs, CMs, neurons)
                - input_dimensions: Dictionary with width and height of input layer
        """
        visualization_data = []

        for idx, (layer_name, layer_dict) in enumerate(model_config.items()):
            params = layer_dict.get("params", {})
            rows = params.get("mac_grid_num_rows", 1)
            cols = params.get("mac_grid_num_cols", 1)
            num_cms = params.get("num_cms_per_mac", 1)
            num_neurons = params.get("num_neurons_per_cm", 1)

            z = idx * 10  # Layer spacing in z-axis
            layer_activation_dict = mac_activations.get(layer_name, {})

            # Place components for this layer
            layer_data = VisualizationService._process_layer(
                rows=rows,
                cols=cols,
                num_cms=num_cms,
                num_neurons=num_neurons,
                z_position=z,
                activations=layer_activation_dict
            )
            visualization_data.extend(layer_data)

        # Get input dimensions from layer_1
        input_dimensions = VisualizationService._get_input_dimensions(model_config)

        return {
            "layers": visualization_data,
            "input_dimensions": input_dimensions
        }

    @staticmethod
    def _process_layer(rows: int, cols: int, num_cms: int, num_neurons: int, 
                      z_position: float, activations: Dict[int, int]) -> List[Dict[str, Any]]:
        """
        Process a single layer's components and their positions.
        
        Args:
            rows: Number of MAC rows in the layer
            cols: Number of MAC columns in the layer
            num_cms: Number of CMs per MAC
            num_neurons: Number of neurons per CM
            z_position: Z-axis position for the layer
            activations: Dictionary of MAC activation states
            
        Returns:
            List of positioned components for the layer
        """
        layer_data = []
        
        # 1) Place MACs in a hex grid
        mac_positions = hex_grid(rows, cols, hex_size=1.5)

        # For each MAC in this layer
        for i, (mac_x, mac_y) in enumerate(mac_positions, start=1):
            is_active = activations.get(i, 0) == 1
            
            # Add MAC
            layer_data.append({
                "type": "mac",
                "x": mac_x,
                "y": mac_y,
                "z": z_position,
                "active": is_active
            })

            # 2) Place CMs inside the MAC
            mac_radius = 2.0
            cm_radius = 0.5
            cm_gap = 0.2

            cm_positions = place_cms_in_mac(
                mac_center_x=mac_x,
                mac_center_y=mac_y,
                mac_radius=mac_radius,
                num_cms=num_cms,
                cm_radius=cm_radius,
                gap=cm_gap
            )

            # Add CMs and their neurons
            for (cm_x, cm_y) in cm_positions:
                # Add CM
                layer_data.append({
                    "type": "cm",
                    "x": cm_x,
                    "y": cm_y,
                    "z": z_position
                })

                # 3) Place neurons inside the CM
                neuron_positions = place_neurons_in_cm(
                    cm_center_x=cm_x,
                    cm_center_y=cm_y,
                    cm_radius=cm_radius,
                    num_neurons=num_neurons,
                    neuron_radius=0.10,
                    gap=0.1
                )

                # Add neurons
                for (nx, ny) in neuron_positions:
                    layer_data.append({
                        "type": "neuron",
                        "x": nx,
                        "y": ny,
                        "z": z_position
                    })

        return layer_data

    @staticmethod
    def _get_input_dimensions(model_config: Dict[str, Any]) -> Dict[str, int]:
        """
        Extract input dimensions from the model configuration.
        
        Args:
            model_config: Dictionary containing layer configurations
            
        Returns:
            Dictionary with width and height of input layer
        """
        layer_1_params = model_config.get("layer_1", {}).get("params", {})
        return {
            "width": layer_1_params.get("prev_layer_mac_grid_num_cols", None),
            "height": layer_1_params.get("prev_layer_mac_grid_num_rows", None)
        }
