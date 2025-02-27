from .base_component import VisualizationComponent

class Neuron(VisualizationComponent):
    """Represents a neuron (leaf node in composite)"""
    def __init__(self, x: float, y: float, z: float):
        self.x = x
        self.y = y
        self.z = z

    def get_visualization_data(self):
        return [{
            "type": "neuron",
            "x": self.x,
            "y": self.y,
            "z": self.z
        }]
