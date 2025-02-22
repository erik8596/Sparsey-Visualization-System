from src.sparseypyvis.core.model.model_composite import ModelComponent
from src.sparseypyvis.core.model.mac import MAC

class Layer(ModelComponent):
    def __init__(self, id):
        self.id = id
        self.macs = []

    def add_mac(self, mac: MAC):
        self.macs.append(mac)

    def get_data(self):
        return {
            'id': self.id,
            'macs': [mac.get_data() for mac in self.macs]
        }