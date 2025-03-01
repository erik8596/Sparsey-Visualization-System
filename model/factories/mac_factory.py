import numpy as np
from model.components.mac import MAC
from model.factories import ComponentFactory

class MACFactory(ComponentFactory):
    def create_component(self, x: float, y: float, z: float, active: bool = False):
        return MAC(x, y, z, active)

    def calculate_positions(self, rows: int, cols: int, hex_size: float = 1.5):
        positions = []
        for row in range(rows):
            for col in range(cols):
                x = col * (2 * hex_size)
                y = row * (np.sqrt(3) * hex_size) + (col % 2) * (np.sqrt(3)/2 * hex_size)
                positions.append((x, y))
        return np.array(positions)
