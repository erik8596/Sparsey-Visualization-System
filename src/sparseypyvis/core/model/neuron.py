from src.sparseypyvis.core.model.model_composite import ModelComponent

class Neuron(ModelComponent):
    def __init__(self, id, data):
        self.id = id
        self.data = data

    def get_data(self):
        return {'id': self.id, 'data': self.data}