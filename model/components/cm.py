from __future__ import annotations
from typing import List
from .base_component import VisualizationComponent
from .neuron import Neuron

class CM(VisualizationComponent):
    """Represents a CM that can contain neurons"""
    def __init__(self, x: float, y: float, z: float):
        self.x = x
        self.y = y
        self.z = z
        self.neurons: List[Neuron] = []

    def add_neuron(self, neuron: Neuron):
        self.neurons.append(neuron)

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
