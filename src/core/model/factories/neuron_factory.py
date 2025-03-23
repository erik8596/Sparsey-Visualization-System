import numpy as np
from src.core.model.components.neuron import Neuron
from src.core.model.factories import ComponentFactory

class NeuronFactory(ComponentFactory):
    def create_component(self, x: float, y: float, z: float, active: bool = False,
                        raw_activation: float = 0.0, avg_activation: float = 0.0):
        # Ensure activation values are properly normalized
        raw_activation = float(raw_activation)
        avg_activation = float(avg_activation)
        return Neuron(x, y, z, active, raw_activation, avg_activation)

    def calculate_positions(self, cm_positions: np.ndarray, num_neurons: int):
        if num_neurons > 1:
            cm_positions = np.array(cm_positions).reshape(-1, 2)
            angles = np.linspace(0, 2 * np.pi, num_neurons, endpoint=False)
            radius = 0.2

            dx = radius * np.cos(angles)
            dy = radius * np.sin(angles)
            offsets = np.stack([dx, dy], axis=1)

            all_positions = cm_positions[:, np.newaxis, :] + offsets[np.newaxis, :, :]
            return all_positions

        return cm_positions[:, np.newaxis, :]
