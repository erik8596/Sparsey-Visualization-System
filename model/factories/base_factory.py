from abc import ABC, abstractmethod

class ComponentFactory(ABC):
    """Abstract factory interface"""
    @abstractmethod
    def create_component(self, x: float, y: float, z: float, **kwargs):
        pass

    @abstractmethod
    def calculate_positions(self, **kwargs):
        pass
