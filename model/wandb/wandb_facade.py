import wandb
from typing import List, Dict, Any
from dataclasses import dataclass, field
from model.wandb.model_config import ModelConfig

STS = "sparsey-testing-system"  # default weights and biases entity name

@dataclass
class WandBFacade:
    """
    A facade class for interacting with Weights & Biases (W&B) API.

    This class provides a simplified interface for accessing W&B projects, runs, and configurations.
    It implements the Singleton pattern to ensure only one instance manages W&B interactions.

    Attributes:
        project_name (str): Name of the current W&B project
        run_name (str): Name of the current run
        run_id (str): ID of the current run
        entity (str): W&B entity/organization name
        projects_list (list): Cached list of available projects
        project_runs (list): Cached list of runs for current project
        run_config (dict): Configuration of current run
        project (object): Current W&B project object
        run (object): Current W&B run object
        mconf (ModelConfig): Model configuration handler
    """

    project_name: str = None
    run_name: str = None
    run_id: str = None

    entity: str = field(default=STS)
    projects_list: list = field(default_factory=list)
    project_runs: list = field(default_factory=list)
    run_config: dict = field(default_factory=dict)
    _api = wandb.Api()

    project: object = None
    run: object = None
    _instance = None

    mconf: ModelConfig = field(default_factory=ModelConfig)

    # singleton init
    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super().__new__(cls)
        return cls._instance

    def api(self):
        """Returns the W&B API instance."""
        return self._api
    
    def _handle_api_error(self, operation: str, error: Exception) -> None:
        """Centralized error handling for WandB API calls."""
        print(f"WandB API error during {operation}: {str(error)}")
        if isinstance(error, wandb.errors.CommError):
            raise ValueError(f"Network error during {operation}: {str(error)}")
        elif isinstance(error, wandb.errors.Error):
            raise ValueError(f"WandB API error during {operation}: {str(error)}")
        else:
            raise ValueError(f"Unexpected error during {operation}: {str(error)}")
        
    def status(self) -> str:
        """
        Returns a formatted string summary of current entity, project, and run.
        
        Returns:
            str: Summary string of current state
        """
        return f"Status:\nEntity: {self.entity}\nProject: {self.project_name}\nRun: {self.run_name}"
    
    def load_projects(self, entity_name: str = None) -> list:
        """
        Fetches and caches all projects for the given entity from W&B.
        Uses cached results if available and valid.
        
        Args:
            entity_name (str, optional): W&B entity to fetch projects from. Defaults to self.entity.
            
        Returns:
            list: List of project names
            
        Raises:
            ValueError: If network, API, or other errors occur during fetch
        """
        entity = entity_name or self.entity
        try:
            print("Attempting to load projects...")

            if self.projects_list is None or len(self.projects_list) == 0:
                projects_list = [project.name for project in self.api().projects(entity)]

                if projects_list is None:
                    projects_list = []
                    print("Either no projects in entity or loading projects failed.")
                
                print(f"Successfully loaded {len(projects_list)} projects.")
                self.projects_list = projects_list
                return projects_list
            else:
                print(f"Returning {len(self.projects_list)} cached projects.")
                # return cached project list
                return self.projects_list
        except Exception as e:
            self.projects_list = []
            self._handle_api_error("project fetching", e)
    
    def load_runs_from_project(self, project_name: str = None, entity_name: str = None) -> List[Dict[str, str]]:
        """Fetch all run IDs and names from a specific project."""
        entity = entity_name or self.entity
        project = project_name or self.project_name

        try:
            print("Attempting to load project runs...")
            
            # load runs from API to compare with cached runs
            loaded_runs = [
                {"id": run.id, "name": run.name} 
                for run in self.api().runs(f'{entity}/{project}')
            ]

            if loaded_runs is None:
                loaded_runs = []
                print("Either no runs in project or loading runs failed.")
            
            # check if cached runs match loaded runs
            if (self.project_runs is not None and 
                set(tuple(run.items()) for run in self.project_runs) == 
                set(tuple(run.items()) for run in loaded_runs)):
                print("Using cached project runs list.")
                return self.project_runs
            else:
                print(f"Successfully loaded {len(loaded_runs)} project runs.")
                self.project_runs = loaded_runs
                return loaded_runs
        except Exception as e:
            self.project_runs = []
            self._handle_api_error("run fetching", e)

    def fetch_project(self, project_name: str = None, entity_name: str = None):
        """
        Retrieves a specific project from W&B API.
        
        Args:
            project_name (str, optional): Name of project to fetch
            entity_name (str, optional): Entity name. Defaults to current entity.
            
        Returns:
            wandb.Api.project: W&B project object
            
        Raises:
            ValueError: If network, API, or other errors occur during fetch
        """
        entity_name = entity_name or self.entity
        if not project_name or (project_name != self.project_name):
            try:
                return self.api().project(project_name, entity_name)
            except Exception as e:
                self.project = None
                self._handle_api_error("project fetching", e)
        else:
            return self.project
    
    def fetch_run(self, run_id: str = None, project_name: str = None, entity_name: str = None):
        """Fetch a specific run from WandB.
        
        Args:
            run_id (str): ID of run to fetch
            project_name (str): Name of project to fetch run from
            
        Returns:
            wandb.Api.run: W&B run object
        """
        entity_name = entity_name or self.entity
        project_name = project_name or self.project_name
        if not run_id or (run_id not in [run['id'] for run in self.project_runs]):
            try:
                return self.api().run(f'{entity_name}/{project_name}/{run_id}')
            except Exception as e:
                self.run = None
                self._handle_api_error("run fetching", e)
        else:
            return self.run

    def update_project(self, project_name: str) -> bool:
        """
        Updates current project with new project data from W&B.
        
        Args:
            project_name (str): Name of project to update to
            
        Returns:
            bool: True if update successful, False if project not found
            
        Raises:
            ValueError: If network, API, or other errors occur during update
        """
        try:
            if project_name in self.projects_list:
                fetched_project = self.fetch_project(project_name)
                self.project = fetched_project
                self.project_name = fetched_project.name
                return True
            else:
                return False
        except Exception as e:
            self.project = None
            self._handle_api_error("project fetching", e)
        
    def update_run(self, run_id: str, project_name: str = None, entity_name: str = None) -> bool:
        """
        Updates current run with new run data from W&B.
        
        Args:
            run_id (str): ID of run to update to
            project_name (str, optional): Project name. Defaults to current project.
            entity_name (str, optional): Entity name. Defaults to current entity.
            
        Returns:
            bool: True if update successful, False if run not found
            
        Raises:
            ValueError: If network, API, or other errors occur during update
        """
        entity = entity_name or self.entity
        project = project_name or self.project_name
        try:
            if run_id in [run['id'] for run in self.project_runs]:                
                print(f"Run id {run_id} found in project runs.")
                fetched_run = self.api().run(f"{entity}/{project}/{run_id}")
                self.run = fetched_run
                self.run_id = fetched_run.id
                self.run_name = fetched_run.name
                self.run_config = fetched_run.config
                return True
            else:
                print(f"Run id {run_id} not found in project runs.")
                return False
        except Exception as e:
            self.run = None
            self._handle_api_error("run fetching", e)
    
    def get_processed_model_config(self, run_id: str = None, project_name: str = None, entity_name: str = None) -> Dict[str, Any]:
        """Fetch processed model configuration and input dimensions."""
        # Get run object, using cached run if possible
        run = self.run if (run_id == self.run_id) else self.fetch_run(
            run_id or self.run_id,
            project_name or self.project_name,
            entity_name or self.entity
        )
        
        try:
            return self.mconf.get_model_config(run)
        except ValueError as e:
            print(f"Error loading model: {e}")
            return None