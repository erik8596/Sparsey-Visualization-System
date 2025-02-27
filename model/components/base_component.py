from abc import ABC, abstractmethod

class VisualizationComponent(ABC):
    """Base component for Composite pattern"""
    @abstractmethod
    def get_visualization_data(self):
        pass
