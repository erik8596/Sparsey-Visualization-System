from src.sparseypyvis.core.model.model_composite import CompositeComponent
from src.sparseypyvis.core.model.layer import Layer

class Model(CompositeComponent):
    def __init__(self, name: str):
        super().__init__(name)

    def get_data(self):
        return {
            'name': self.name,
            'children': [child.get_data() for child in self.get_children()]
        }
  