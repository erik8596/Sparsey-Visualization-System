import numpy as np
from model.components.cm import CM
from model.factories import ComponentFactory

class CMFactory(ComponentFactory):
    def create_component(self, x: float, y: float, z: float):
        return CM(x, y, z)

    def calculate_positions(self, mac_positions: np.ndarray, num_cms: int):
        if num_cms > 1:
            mac_positions = np.array(mac_positions).reshape(-1, 2)
            angles_cms = np.linspace(0, 2*np.pi, num_cms, endpoint=False)
            offsets_cms = np.stack([np.cos(angles_cms), np.sin(angles_cms)], axis=1) * 1
            all_positions = mac_positions[:, None, :] + offsets_cms[None, :, :]
            return all_positions
        return mac_positions[:, np.newaxis, :]
