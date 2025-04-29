from __future__ import annotations
from typing import Dict, Any, List
from dataclasses import dataclass, field
import numpy as np
import logging
from src.core.model.factories import MACFactory, CMFactory, NeuronFactory
from src.core.model.components import MAC, CM, Neuron
from src.core.model.processors import VisualizationStrategy

logger = logging.getLogger(__name__)

@dataclass
class LayeredVisualizationStrategy(VisualizationStrategy):
    """Concrete strategy for layered visualization"""

    mac_factory: MACFactory = field(default_factory=MACFactory)
    cm_factory: CMFactory = field(default_factory=CMFactory)
    neuron_factory: NeuronFactory = field(default_factory=NeuronFactory)

    def process(self, model_config: Dict[str, Any], mac_activations: Dict[str, Dict[int, int]],
                input_activations: Dict[int, int] = None,
                neuron_activations: Dict[str, Dict[int, Dict[int, Dict[int, List[float]]]]] = None) -> Dict[str, Any]:
        visualization_data = []

        # Process regular layers
        for idx, (layer_name, layer_dict) in enumerate(model_config.items(), 1):
            layer_neuron_activations = neuron_activations.get(layer_name, {}) if neuron_activations else {}

            visualization_data.extend(
                self._process_layer(idx, layer_name, layer_dict, mac_activations, layer_neuron_activations)
            )

        # Initialize the result with the base visualization data
        result = {
            "layers": visualization_data,
            "input_dimensions": self._get_input_dimensions(model_config)
        }

        # Format input activations with the expected key pattern
        if input_activations:
            for pixel_idx, activation in input_activations.items():
                result[f"input_activations/pixel_{pixel_idx}"] = activation

        # Format MAC activations with the expected key pattern
        if mac_activations:
            for layer_name, layer_activations in mac_activations.items():
                for mac_idx, activation in layer_activations.items():
                    result[f"neuron_activations/{layer_name}/mac_{mac_idx}"] = activation

        # Format detailed neuron activations
        if neuron_activations:
            for layer_name, layer_data in neuron_activations.items():
                for mac_idx, mac_data in layer_data.items():
                    for cm_idx, cm_data in mac_data.items():
                        for neuron_idx, neuron_history in cm_data.items():
                            if neuron_history:
                                # Use the latest activation value
                                latest_value = neuron_history[-1]
                                result[f"neuron_activations/{layer_name}/mac_{mac_idx}/cm_{cm_idx}/neuron_{neuron_idx}"] = latest_value

        return result

    def _process_layer(self, idx: int, layer_name: str, layer_dict: Dict[str, Any],
                      mac_activations: Dict[str, Dict[int, int]],
                      neuron_activations: Dict[int, Dict[int, Dict[int, List[float]]]]) -> List[Dict[str, Any]]:
        params = layer_dict.get("params", {})
        z = idx * 10
        layer_data = []

        mac_positions = self._get_mac_positions(params)
        layer_activation_dict = mac_activations.get(layer_name, {})

        for mac_idx, (x, y) in enumerate(mac_positions, start=1):
            # Get MAC-specific neuron activations
            mac_neuron_activations = neuron_activations.get(mac_idx, {})

            mac = self._create_mac_with_components(
                x, y, z, mac_idx, params,
                layer_activation_dict,
                mac_neuron_activations
            )
            layer_data.extend(mac.get_visualization_data())

        return layer_data

    def _get_mac_positions(self, params: Dict[str, Any]) -> np.ndarray:
        return self.mac_factory.calculate_positions(
            rows=params.get("mac_grid_num_rows", 1),
            cols=params.get("mac_grid_num_cols", 1)
        )

    def _get_cm_positions(self, x: float, y: float, params: Dict[str, Any]) -> np.ndarray:
        """Calculate positions of CMs within a MAC"""
        return self.cm_factory.calculate_positions(
            np.array([[x, y]]),  # Base position of the MAC
            params.get("num_cms_per_mac", 1)  # Number of CMs to position
        )

    def _create_mac_with_components(self, x: float, y: float, z: float,
                                  mac_idx: int, params: Dict[str, Any],
                                  activations: Dict[int, int],
                                  mac_neuron_activations: Dict[int, Dict[int, List[float]]]) -> 'MAC':
        # Create MAC with its activation state
        is_active = activations.get(mac_idx, 0) == 1
        mac = self.mac_factory.create_component(x, y, z, active=is_active)

        # Get CM positions
        cm_positions = self._get_cm_positions(x, y, params)
        neurons_per_cm = params.get("num_neurons_per_cm", 1)

        # Create CMs with their neurons
        for cm_idx, cm_pos in enumerate(cm_positions.reshape(-1, 2)):
            cm_neuron_activations = mac_neuron_activations.get(cm_idx, {})

            cm = self._create_cm_with_neurons(
                cm_pos[0], cm_pos[1], z, params,
                neurons_per_cm,
                cm_neuron_activations
            )
            mac.add_subcomponent(cm)

        return mac

    def _create_cm_with_neurons(self, x: float, y: float, z: float,
                              params: Dict[str, Any],
                              neurons_per_cm: int,
                              neuron_activations: Dict[int, List[float]] = None) -> 'CM':
        cm = self.cm_factory.create_component(x, y, z)

        neuron_positions = self.neuron_factory.calculate_positions(
            np.array([[x, y]]),
            neurons_per_cm
        )

        # Create neurons with their states
        neuron_activations = neuron_activations or {}
        for neuron_idx in range(neurons_per_cm):
            neuron_pos = neuron_positions.reshape(-1, 2)[neuron_idx % len(neuron_positions.reshape(-1, 2))]

            # Get neuron activation history
            neuron_history = neuron_activations.get(neuron_idx, [])

            # Default values
            is_active = False
            raw_activation = 0.0
            avg_activation = 0.0

            if neuron_history:
                # Get latest state (most recent value in the history)
                latest = neuron_history[-1]
                # Check if active (==1) and handle NaN values
                is_active = (latest == 1.0) if not np.isnan(latest) else False
                raw_activation = float(latest) if not np.isnan(latest) else 0.0
                # Calculate average activation (skip NaN values)
                valid_values = [v for v in neuron_history if not np.isnan(v)]
                avg_activation = float(sum(valid_values) / len(valid_values)) if valid_values else 0.0

            neuron = self.neuron_factory.create_component(
                neuron_pos[0], neuron_pos[1], z,
                active=is_active,
                raw_activation=raw_activation,
                avg_activation=avg_activation
            )
            cm.add_subcomponent(neuron)

        return cm

    def _get_input_dimensions(self, model_config: Dict[str, Any]) -> Dict[str, int]:
        layer_1_params = model_config.get("layer_1", {}).get("params", {})
        return {
            "width": layer_1_params.get("prev_layer_mac_grid_num_cols"),
            "height": layer_1_params.get("prev_layer_mac_grid_num_rows")
        }
