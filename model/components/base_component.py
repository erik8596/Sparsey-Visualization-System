from abc import ABC, abstractmethod

class BaseComponent(ABC):
    """Base component for Composite pattern"""

    @abstractmethod
    def add_subcomponent(self, subcomponent: 'BaseComponent') -> None:
        pass

    @abstractmethod
    def get_visualization_data(self):
        pass
