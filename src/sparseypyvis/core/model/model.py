from src.sparseypyvis.core.model.model_composite import CompositeComponent
from src.sparseypyvis.core.model.layer import Layer

class Model(CompositeComponent):
    def __init__(self, id):
        super().__init__(name=f"Model_{id}")
        self.id = id
        self.layers = []

    def add_layer(self, layer: Layer):
        self.layers.append(layer)

    def get_data(self):
        return {
            'id': self.id,
            'layers': [layer.get_data() for layer in self.layers]
        }