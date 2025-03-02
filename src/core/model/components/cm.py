from __future__ import annotations
from typing import List
from dataclasses import dataclass, field
from src.core.model.components import Neuron
from src.core.model.components import BaseComponent

@dataclass
class CM(BaseComponent):
    """Represents a CM that can contain neurons"""
    x: float
    y: float 
    z: float
    neurons: List[Neuron] = field(default_factory=list)

    def add_subcomponent(self, subcomponent: BaseComponent) -> None:
        if isinstance(subcomponent, Neuron):
            self.neurons.append(subcomponent)
        else:
            raise ValueError(f"Unsupported subcomponent type: {type(subcomponent)}.")

    def get_visualization_data(self):
        data = [{
            "type": "cm",
            "x": self.x,
            "y": self.y,
            "z": self.z
        }]
        for neuron in self.neurons:
            data.extend(neuron.get_visualization_data())
        return data
    