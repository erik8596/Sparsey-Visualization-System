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
                input_activations: Dict[int, int] = None, neuron_activations: Dict[str, Dict[int, List[int]]] = None) -> Dict[str, Any]:
        visualization_data = []

        # Process regular layers
        for idx, (layer_name, layer_dict) in enumerate(model_config.items(), 1):
            layer_neuron_activations = neuron_activations.get(layer_name, {}) if neuron_activations else {}
            visualization_data.extend(
                self._process_layer(idx, layer_name, layer_dict, mac_activations, layer_neuron_activations)
            )

        return {
            "layers": visualization_data,
            "input_dimensions": self._get_input_dimensions(model_config),
            "input_activations": input_activations or {}
        }

    def _process_layer(self, idx: int, layer_name: str, layer_dict: Dict[str, Any],
                      mac_activations: Dict[str, Dict[int, int]],
                      neuron_activations: Dict[int, List[int]]) -> List[Dict[str, Any]]:
        params = layer_dict.get("params", {})
        z = idx * 10
        layer_data = []

        mac_positions = self._get_mac_positions(params)
        layer_activation_dict = mac_activations.get(layer_name, {})

        for i, (x, y) in enumerate(mac_positions, start=1):
            mac = self._create_mac_with_components(
                x, y, z, i, params,
                layer_activation_dict,
                neuron_activations.get(i, [])
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
                                    mac_neuron_activations: List[int]) -> 'MAC':
        # Create MAC with its activation state
        is_active = activations.get(mac_idx, 0) == 1
        mac = self.mac_factory.create_component(x, y, z, active=is_active)

        # Get CM positions and distribute neurons
        cm_positions = self._get_cm_positions(x, y, params)
        neurons_per_cm = params.get("num_neurons_per_cm", 1)
        total_neurons = neurons_per_cm * params.get("num_cms_per_mac", 1)

        # Get activation states for neurons
        neuron_states = mac_neuron_activations if mac_neuron_activations else []
        if len(neuron_states) > 0:
            # Get latest state if we have history
            neuron_states = [int(state) for state in neuron_states]  # Ensure integers
        else:
            neuron_states = [0] * total_neurons  # Default to inactive

        # Distribute states across CMs
        for cm_idx, cm_pos in enumerate(cm_positions.reshape(-1, 2)):
            start_idx = cm_idx * neurons_per_cm
            end_idx = start_idx + neurons_per_cm
            cm_neuron_states = neuron_states[start_idx:end_idx] if start_idx < len(neuron_states) else [0] * neurons_per_cm

            cm = self._create_cm_with_neurons(
                cm_pos[0], cm_pos[1], z, params,
                neuron_states=cm_neuron_states
            )
            mac.add_subcomponent(cm)

        return mac

    def _create_cm_with_neurons(self, x: float, y: float, z: float,
                                params: Dict[str, Any],
                                neuron_states: List[int] = None) -> 'CM':
        cm = self.cm_factory.create_component(x, y, z)

        neuron_positions = self.neuron_factory.calculate_positions(
            np.array([[x, y]]),
            params.get("num_neurons_per_cm", 1)
        )

        # Create neurons with their states
        neuron_states = neuron_states if neuron_states else []
        for i, neuron_pos in enumerate(neuron_positions.reshape(-1, 2)):
            # Convert to bool and ensure we have a state
            is_active = bool(int(neuron_states[i])) if i < len(neuron_states) else False

            neuron = self.neuron_factory.create_component(
                neuron_pos[0], neuron_pos[1], z,
                active=is_active,
                raw_activation=float(is_active)
            )
            cm.add_subcomponent(neuron)

        return cm

    def _get_input_dimensions(self, model_config: Dict[str, Any]) -> Dict[str, int]:
        layer_1_params = model_config.get("layer_1", {}).get("params", {})
        return {
            "width": layer_1_params.get("prev_layer_mac_grid_num_cols"),
            "height": layer_1_params.get("prev_layer_mac_grid_num_rows")
        }
