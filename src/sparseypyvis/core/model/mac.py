from src.sparseypyvis.core.model.model_composite import ModelComponent
from src.sparseypyvis.core.model.neuron import Neuron

class MAC(ModelComponent):
    def __init__(self, id):
        self.id = id
        self.neurons = []

    def add_neuron(self, neuron: Neuron):
        self.neurons.append(neuron)

    def get_data(self):
        return {
            'id': self.id,
            'neurons': [neuron.get_data() for neuron in self.neurons]
        }