from abc import ABC, abstractmethod
from typing import List, Optional

class ModelComponent(ABC):

    def __init__(self, name: str) -> None:
        self.name = name
        self.parent: Optional['ModelComponent'] = None

    @abstractmethod
    def get_data(self):
        pass

    def add(self, component: 'ModelComponent') -> None:
        """Add a child component - default implementation raises exception"""
        raise NotImplementedError("Leaf nodes cannot add children")
    
    def remove(self, component: 'ModelComponent') -> None:
        """Remove a child component - default implementation raises exception"""
        raise NotImplementedError("Leaf nodes cannot remove children")
    
    def get_children(self) -> List['ModelComponent']:
        """Get child components - default implementation returns empty list"""
        return []

    def is_composite(self) -> bool:
        """Returns whether this component can have children"""
        return False

class CompositeComponent(ModelComponent):
    def __init__(self, name: str):
        super().__init__(name)
        self._children: List[ModelComponent] = []

    def add(self, component: ModelComponent) -> None:
        self._children.append(component)
        component.parent = self

    def remove(self, component: ModelComponent) -> None:
        self._children.remove(component)
        component.parent = None

    def get_children(self) -> List[ModelComponent]:
        return self._children

    def is_composite(self) -> bool:
        return True

    def get_data(self):
        # Combine data from all children
        return [child.get_data() for child in self._children]
        