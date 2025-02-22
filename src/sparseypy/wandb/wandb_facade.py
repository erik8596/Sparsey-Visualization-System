# WandB Facade Class

import wandb
import logging
from dataclasses import dataclass, field
import yaml

STS = "sparsey-testing-system"  # default entity name for weights and biases

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

@dataclass
class WandBFacade:
    project_name: str = None
    project_id: str = None
    run_name: str = None
    run_id: str = None
    run_config: dict = field(default_factory=dict)
    entity: str = field(default=STS)
    projects_list: list = field(default_factory=list)
    project_runs: list = field(default_factory=list)
    runs_list: list = field(default_factory=list)
    _api: wandb.Api = field(default_factory=wandb.Api)

    project: object = None
    run: object = None
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super().__new__(cls)
        return cls._instance

    def summary(self) -> str:
        return f"\nEntity: {self.entity}\nProject Id: {self.project_id} -> {self.project}\nRun Id: {self.run_id} -> {self.run}"
    
    def get_status(self) -> dict[str]:
        return self.__dict__
    
    def load_projects(self, entity_name: str = None) -> list:
        entity = entity_name or self.entity
        try:
            print("Attempting to load projects...")

            if self.projects_list is None or len(self.projects_list) == 0:
                projects_list = [project.name for project in self._api.projects(entity)]

                if projects_list is None:
                    projects_list = []
                    print("Either no projects in entity or loading projects failed.")
                
                print(f"Successfully loaded {len(projects_list)} projects.")
                self.projects_list = projects_list
                return projects_list
            else:
                # return cached project list
                return self.projects_list
        except wandb.errors.CommError as e:
            self.projects_list = None  # Reset on error
            raise ValueError(f"Network error while fetching projects: {e}") 
        except wandb.errors.Error as e:
            self.projects_list = None  # Reset on error
            raise ValueError(f"WandB API error: {e}")
        except Exception as e:
            self.projects_list = None  # Reset on error
            raise ValueError(f"Unexpected error: {e}")
        

    def load_project_runs(self, project_name: str = None, entity_name: str = None) -> list:
        entity = entity_name or self.entity
        project = project_name or self.project

        try:
            print("Attempting to load project runs...")
            
            # load runs from API to compare with cached runs
            loaded_runs = [
                {"id": run.id, "name": run.name} 
                for run in self._api.runs(f'{entity}/{project}')
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

        except wandb.errors.CommError as e:
            self.project_runs = None  # Reset on error
            raise ValueError(f"Network error while fetching project runs: {e}")
        except wandb.errors.Error as e:
            self.project_runs = None  # Reset on error
            raise ValueError(f"WandB API error: {e}")
        except Exception as e:
            self.project_runs = None  # Reset on error
            raise ValueError(f"Unexpected error while fetching project runs: {e}")
        
    def fetch_project(self, project_name: str = None, entity_name: str = None) -> wandb.Api.project:
        entity_name = entity_name or self.entity
        if not project_name or (project_name != self.project_name):
            try:
                return self._api.project(project_name, entity_name)
            except wandb.errors.CommError as e:
                raise ValueError(f"Network error while fetching project: {e}")
            except wandb.errors.Error as e:
                raise ValueError(f"WandB API error: {e}")
            except Exception as e:
                raise ValueError(f"Unexpected error while fetching project: {e}")
        else:
            return self.project
        
    def fetch_run(self, run_id: str, project_name: str = None, entity_name: str =  None) -> wandb.Api.run:
        entity_name = entity_name or self.entity
        project_name = project_name or self.project_name
        if not run_id or (run_id not in self.project_runs):
            try:
                return self._api.run(f'{entity_name}/{project_name}/{run_id}')
            except wandb.errors.CommError as e:
                raise ValueError(f"Network error while fetching run: {e}")
            except wandb.errors.Error as e:
                raise ValueError(f"WandB API error: {e}")
            except Exception as e:
                raise ValueError(f"Unexpected error while fetching run: {e}")
        else:
            return self.run
        
    def update_project(self, project_name: str) -> bool:
        try:
            if project_name in self.projects_list:
                fetched_project = self.fetch_project(project_name)
                self.project = fetched_project
                self.project_name = fetched_project.name
                return True
            else:
                return False
        except wandb.errors.CommError as e:
            print(f"Network error while updating project: {e}")
            raise ValueError(f"Failed to update project due to network error: {e}")
        except wandb.errors.Error as e:
            print(f"WandB API error while updating project: {e}")
            raise ValueError(f"Failed to update project due to API error: {e}")
        except Exception as e:
            print(f"Unexpected error while updating project: {e}")
            raise ValueError(f"Failed to update project due to unexpected error: {e}")
        
    def update_run(self, run_id: str, project_name: str = None, entity_name: str = None) -> bool:
        entity = entity_name or self.entity
        project = project_name or self.project_name
        try:
            if run_id in self.project_runs:
                fetched_run = self._api.run(f"{entity}/{project}/{run_id}")
                self.run = fetched_run
                self.run_id = fetched_run.id
                self.run_name = fetched_run.name
                self.run_config = fetched_run.config
                return True
            else:
                return False
        except wandb.errors.CommError as e:
            print(f"Network error while updating run: {e}")
            raise ValueError(f"Failed to update run due to network error: {e}")
        except wandb.errors.Error as e:
            print(f"WandB API error while updating run: {e}")
            raise ValueError(f"Failed to update run due to API error: {e}")
        except Exception as e:
            print(f"Unexpected error while updating run: {e}")
            raise ValueError(f"Failed to update run due to unexpected error: {e}")

    def fetch_model_config(self, run_id: str = None, project_name: str = None, entity_name: str = None) -> dict:
        entity = entity_name or self.entity
        project_name = project_name or self.project_name
        run_id = run_id or self.run_id
        run = self.run
        try:
            if (run_id is not self.run_id) or (project_name is not self.project_name) or (entity_name is not self.entity):
                run = self.fetch_run(run_id, project_name, entity)
            
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
                raise ValueError(f"No layer configuration found in run {run_id}: {run.name}")

            print(f"Successfully fetched model config for run {run_id}: {run.name}")
            return model_config
        except wandb.errors.CommError as e:
            print(f"Network error while fetching model config: {e}")
            raise ValueError(f"Failed to fetch model config due to network error: {e}")
        except wandb.errors.Error as e:
            print(f"WandB API error while fetching model config: {e}")
            raise ValueError(f"Failed to fetch model config due to API error: {e}")
        except Exception as e:
            print(f"Unexpected error while fetching model config: {e}")
            raise ValueError(f"Failed to fetch model config due to unexpected error: {e}")