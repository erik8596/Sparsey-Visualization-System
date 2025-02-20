# WandB Facade Class

import wandb
import logging
from dataclasses import dataclass
import yaml

@dataclass
class WandBConfig:
    def __init__(self, config_path="config/wandb.yaml"):
        """Initialize WandB configuration from yaml file.
        
        Args:
            config_path (str): Path to the WandB config yaml file
        """
        self.config_path = config_path
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
            
        self.__user_email = config.get('user_email', '')
        self.__entity = config.get('entity', '')
        self.__project = config.get('project', '')
        self.__run_name = config.get('run_name', '')
        self.__run_id = config.get('run_id', '')

    def __save_config(self):
        """Save current configuration back to yaml file"""
        config = {
            'user_email': self.__user_email,
            'entity': self.__entity,
            'project': self.__project,
            'run_name': self.__run_name,
            'run_id': self.__run_id
        }
        with open(self.config_path, 'w') as f:
            yaml.dump(config, f)

    def get_user_email(self) -> str:
        """Return the user's email address.
        
        Returns:
            str: The configured user email address
        """
        return self.__user_email

    def set_user_email(self, email: str):
        """Set the user's email address and save to config.
        
        Args:
            email (str): New email address to set
        """
        self.__user_email = email
        self.__save_config()

    def get_entity(self) -> str:
        """Return the entity name.
        
        Returns:
            str: The configured entity name
        """
        return self.__entity
    
    def set_entity(self, entity: str):
        """Set the entity name and save to config.
        
        Args:
            entity (str): New entity name to set
        """
        self.__entity = entity
        self.__save_config()
    
    def get_project(self) -> str:
        """Return the project name.
        
        Returns:
            str: The configured project name
        """
        return self.__project

    def set_project(self, project: str):
        """Set the project name and save to config.
        
        Args:
            project (str): New project name to set
        """
        self.__project = project
        self.__save_config()

    def get_run(self):
        """Return the run name.
        
        Returns:
            str: The configured run name
        """
        if self.__run_name and self.__run_id:
            return [self.__run_id, self.__run_name]
    
    def set_run(self, run):
        """Set the current run from the run_id and save to config.
        
        Args:
            project (str): New run name to set
        """
        self.__run_id = run['id']
        self.__run_name = run['name']
        self.__save_config()

    
    def status(self) -> str:
        """Returns a dictionary of current attributes"""
        return {
            "user_email": self.__user_email,
            "entity": self.__entity, 
            "project": self.__project,
            "run_name": self.__run_name,
            "run_id": self.__run_id
        }


class WandBFacade:
    _instance = None
    _initialized = False  # Add this to track initialization

    def __new__(cls, *args, **kwargs):
        """Ensure only one instance of WandBFacade exists"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, entity=None, api=None, config=None):
        """Initialize the WandBFacade instance only once"""
        # Guard against re-initialization of the singleton
        if not self._initialized:
            self.config = config or WandBConfig()
            self.project = self.config.get_project()
            self.entity = entity or self.config.get_entity()
            self.api = api or wandb.Api()
            
            self.ENTITY_PROJECT = f"{self.entity}/{self.project}"

            # Store available projects
            self.projects_list = None
            # Store available runs in configured project
            self.project_runs = None
            
            # Mark as initialized
            self.__class__._initialized = True

    def load_projects(self) -> list:
        """Get all available projects from WandB.
        
        Returns:
            list: List of available projects
        """
        try:
            print("WandBFacade: Attempting to load projects")
            # Reset projects_list if it's None
            if self.projects_list is None:
                self.projects_list = [project.name for project in self.api.projects(entity=self.entity)]
                print(f"WandBFacade: Projects loaded successfully: {self.projects_list is not None}")
            else:
                print("WandBFacade: Returning cached projects list")
            return self.projects_list
        
        except wandb.errors.CommError as e:
            print(f"WandBFacade: Network error while fetching projects: {e}")
            self.projects_list = None  # Reset on error
            raise ValueError(f"Network error while fetching projects: {e}") 
        except wandb.errors.Error as e:
            print(f"WandBFacade: WandB API error: {e}")
            self.projects_list = None  # Reset on error
            raise ValueError(f"WandB API error: {e}")
        except Exception as e:
            print(f"WandBFacade: Unexpected error: {e}")
            self.projects_list = None  # Reset on error
            raise ValueError(f"Unexpected error: {e}")

    def load_runs_by_project(self, project_name: str = None) -> dict:
        """Get all available runs within a project from WandB.
        
        Args:
            project_name: Name of the project to load runs from
            
        Returns:
            list: List of available runs in a project
        """
        # Use provided project name or default to class project
        entity_project = self.ENTITY_PROJECT
        if project_name:
            if project_name in self.projects_list:
                entity_project = f"{self.entity}/{project_name}"
            else:
                raise ValueError(f"Project {project_name} not found in available projects")

        try:
            # always fetch fresh runs for the selected project
            project_runs = [
                {"id": run.id, "name": run.name} 
                for run in self.api.runs(entity_project, order="-created_at")
            ]
            print(f"WandBFacade: Loaded {len(project_runs)} runs for project {project_name}")
            return project_runs
        except wandb.errors.CommError as e:
            logging.error(f"Network error while fetching runs: {e}")
            raise ValueError(f"Network error while fetching runs: {e}") 
        except wandb.errors.Error as e:
            logging.error(f"WandB API error: {e}")
            raise ValueError(f"WandB API error: {e}")
        except Exception as e:
            logging.error(f"Unexpected error: {e}")
            raise ValueError(f"Unexpected error: {e}")

    def fetch_run(self, run_id: str = None):
        """
        Returns the run object from weights and biases for the particular run id.
        Uses the configured value or the supplied argument value for run_id
        """
        if not run_id:
            run_info = self.config.get_run()
            if not run_info:
                raise ValueError("No run configured. Please provide run_id or configure a run first.")
            run_id = run_info[0]

        try:
            return self.api.run(f"{self.ENTITY_PROJECT}/{run_id}")
        except Exception as e:
            print(e)
            

    def get_run_info(self):
        """Get basic information about all runs in the project.
        
        Returns:
            list: List of dictionaries containing run ID, name and URL for each run
        """
        run_info = []
        for run in self.project_runs:
            run_info.append({
                "id": run.id,
                "name": run.name, 
                "url": run.url
            })
        return run_info

    def get_run_by_id(self, run_id: str):
        """Get a specific run by its ID.
        
        Args:
            run_id (str): The ID of the run to retrieve
            
        Returns:
            Run: WandB Run object if found, None otherwise
        """
        if self.project_runs is not None:
            for run in self.project_runs:
                if run.get('id') == run_id:
                    return self.fetch_run(run_id)
        return None

    def get_run_metrics(self, run_id: str = None) -> dict:
        """Get metrics for a specific run.
        
        Args:
            run_id (str, optional): The ID of the run to get metrics for. If not provided,
                                  uses the currently configured run ID.
            
        Returns:
            dict: Dictionary containing the run's metrics
            
        Raises:
            ValueError: If run_id is invalid or no run is configured
        """
        # Use provided run_id or get from config
        if not run_id:
            run_info = self.config.get_run()
            if not run_info:
                raise ValueError("No run configured. Please provide run_id or configure a run first.")
            run_id = run_info[0]
            
        # Get the run
        run = self.get_run_by_id(run_id)
        if not run:
            raise ValueError(f"Run with ID {run_id} not found")
            
        return run.history()
    
    def set_run(self, run: dict) -> bool:
        """Set the current run and save it to config.
        
        Args:
            run (dict): Dictionary containing run information with 'id' and 'name' keys
            
        Returns:
            bool: True if run was successfully set, False otherwise
            
        Raises:
            ValueError: If run dictionary is missing required keys
        """
        if not run:
            return False
            
        try:
            if not isinstance(run, dict) or not all(key in run for key in ['id', 'name']):
                raise ValueError("Run must be a dictionary containing 'id' and 'name' keys")
                
            self.config.set_run(run=run)
            return True
            
        except Exception as e:
            logging.error(f"Failed to set run: {e}")
            return False

    def fetch_model(self, project_name: str = None, run_id: str = None) -> dict:
        """Fetch model configuration from a specific WandB run.
        
        If project_name and run_id are not provided, uses the currently configured run.
        
        Args:
            project_name (str, optional): Name of the WandB project
            run_id (str, optional): ID of the run to fetch
            
        Returns:
            dict: Dictionary containing the model's configuration
            
        Raises:
            ValueError: If run cannot be found or accessed
        """
        try:
            
            # Use provided values or fall back to configured values
            if not project_name and not run_id:
                run_info = self.config.get_run()
                if not run_info or len(run_info) != 2:
                    raise ValueError("No valid run configured. Please provide run_id and project_name or configure a run first.")
                run_id = run_info[0]  # First element is run_id
            # logging.info(f"Fetching WandB run: {run_path}")
            
            run = self.fetch_run(f"{self.ENTITY_PROJECT}/{run_id}")
            
            # Extract all relevant model information
            model_config = {
                'model': run.config.get('model', {}),
                'metadata': {
                    'created_at': run.created_at,
                    'name': run.name,
                    'tags': run.tags,
                    'group': run.group
                }
            }
            
            if not model_config['model']['layers']:
                raise ValueError(f"No layer configuration found in run {run_id}")
                
            logging.info(f"Successfully fetched model config for run: {run_id}")
            return model_config

        except wandb.errors.CommError as e:
            error_msg = f"Network error while fetching WandB run: {str(e)}"
            logging.error(error_msg)
            raise ValueError(error_msg)
        except wandb.errors.Error as e:
            error_msg = f"WandB API error: {str(e)}"
            logging.error(error_msg)
            raise ValueError(error_msg)
        except Exception as e:
            error_msg = f"Unexpected error while fetching model: {str(e)}"
            logging.error(error_msg)
            raise ValueError(error_msg)