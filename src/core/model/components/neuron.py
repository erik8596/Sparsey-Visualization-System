from dataclasses import dataclass
from src.core.model.components import BaseComponent

@dataclass
class Neuron(BaseComponent):
    """Represents a neuron (leaf node in composite)"""
    x: float
    y: float
    z: float

    def add_subcomponent(self, subcomponent: BaseComponent) -> None:
        raise ValueError("Neuron is a leaf node and cannot have subcomponents.")

    def get_visualization_data(self):
        return [{
            "type": "neuron",
            "x": self.x,
            "y": self.y,
            "z": self.z
        }]
