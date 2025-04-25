import wandb
import os
from torch import load as torch_load
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass, field
from src.core.model.wandb.model_config import ModelConfig
import concurrent.futures


STS = "sparsey-testing-system"  # default weights and biases entity name
DATA_ARTIFACT_STORE_PATH = "data/artifact_store"

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
        Returns a formatted string artifact of current entity, project, and run.
        
        Returns:
            str: artifact string of current state
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
    
    def _extract_run_info(self, run: Any) -> Dict[str, str]:
        """Helper function to extract ID and name from a W&B run object."""
        try:
            return {"id": run.id, "name": run.name}
        except AttributeError:
            # Handle cases where run object might not have expected attributes
            print(f"Warning: Could not extract info from a run object: {run}")
            return None # Return None to filter out later

    def load_runs_from_project(self, project_name: str = None, entity_name: str = None, max_workers: int = None) -> List[Dict[str, str]]:
        """Fetch all run IDs and names from a specific project, using parallel processing."""
        entity = entity_name or self.entity
        project = project_name or self.project_name

        try:
            print("Attempting to load project runs...")
            
            # Fetch the list of run objects from the API
            all_runs = list(self.api().runs(f'{entity}/{project}'))

            if not all_runs:
                print("No runs found in the project.")
                self.project_runs = []
                return []

            print(f"Found {len(all_runs)} runs. Extracting info in parallel...")
            
            loaded_runs_info = []
            workers = max_workers if max_workers and max_workers > 0 else None
            
            # Use ThreadPoolExecutor to extract run info in parallel
            # Note: The primary benefit here might be limited if the bottleneck is the initial API call to list runs, 
            # but this structure allows for potentially more complex per-run processing later if needed.
            with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
                # Submit tasks for each run object
                future_to_run = {executor.submit(self._extract_run_info, run): run for run in all_runs}

                # Collect results as they complete
                for future in concurrent.futures.as_completed(future_to_run):
                    run_info = future.result()
                    if run_info: # Add to list only if info extraction was successful
                        loaded_runs_info.append(run_info)

            if not loaded_runs_info:
                print("Loading runs failed or no valid run info extracted.")
                self.project_runs = []
                return []

            # Sort by name for consistent comparison (optional, but good practice)
            loaded_runs_info.sort(key=lambda x: x.get('name', ''))
            
            # check if cached runs match loaded runs (after sorting both for consistency)
            cached_runs_sorted = sorted(self.project_runs, key=lambda x: x.get('name', '')) if self.project_runs else []
            
            if cached_runs_sorted == loaded_runs_info:
                print("Using cached project runs list.")
                return self.project_runs # Return original (unsorted) cache
            else:
                print(f"Successfully loaded info for {len(loaded_runs_info)} project runs.")
                self.project_runs = loaded_runs_info # Update cache with the new (sorted) list
                return loaded_runs_info
                
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
    
    def get_processed_model_config(self, run_id: str = None, project_name: str = None, entity_name: str = None) -> Optional[ModelConfig]:
        """Fetch processed model configuration and input dimensions."""
        # Get run object, using cached run if possible
        run = self.run if (run_id == self.run_id) else self.fetch_run(
            run_id or self.run_id,
            project_name or self.project_name,
            entity_name or self.entity
        )
        
        try:
            # Get the new model config instance
            processed_config = self.mconf.get_model_config(run)
            # Update the facade's internal mconf instance
            self.mconf = processed_config
            return processed_config # Return the updated config
        except ValueError as e:
            print(f"Error loading model config in facade: {e}")
            return None
        
    def fetch_run_history(self, run_id: str = None, project_name: str = None, entity_name: str = None) -> List[Dict[str, Any]]:
        """Fetch run history from W&B."""
        run = self.run if (run_id == self.run_id) else self.fetch_run(
            run_id or self.run_id,
            project_name or self.project_name,
            entity_name or self.entity
        )

        try:
            step_history = {}
            for step in run.scan_history():
                step_history[step['_step']] = step
            self.run_history = step_history
            return self.run_history
        except Exception as e:
            self._handle_api_error("run history fetching", e)
            return []   
        
    def _process_artifact_version(self,
                                  artifact: Any, 
                                  entity: str, 
                                  proj: str, 
                                  rid: str, 
                                  download_dir_root: str
                                  ) -> Tuple[Optional[int], Optional[Any]]:
        """Processes a single artifact version: checks cache, downloads, loads .pt file."""
        version_index = None # Initialize in case of early return or error before assignment
        try:
            # Extract version index from the name, e.g., 'run_id-weights:v12' -> 12
            version_str = artifact.name.split(':')[-1]
            if not version_str.startswith('v'):
                print(f"Skipping artifact (unexpected version format): {artifact.name}")
                return None, None
            version_index = int(version_str[1:])

            # Define paths
            artifact_full_name = f"{entity}/{proj}/{artifact.name}"
            version_download_dir = os.path.join(download_dir_root, f"v{version_index}")
            
            # --- Caching Check --- 
            pt_file_path = None
            # Check if version directory exists first
            if os.path.isdir(version_download_dir):
                # Look for existing .pt file
                for filename in os.listdir(version_download_dir):
                    if filename.endswith('.pt'):
                        pt_file_path = os.path.join(version_download_dir, filename)
                        print(f"Cache hit for v{version_index}: Found existing {filename}. Loading directly.")
                        try:
                            artifact_data = torch_load(pt_file_path)
                            return version_index, artifact_data
                        except Exception as e:
                            print(f"Error loading cached file {pt_file_path} for v{version_index}: {e}. Will attempt redownload.")
                            pt_file_path = None # Reset path to trigger download
                        break # Found a .pt file, stop searching this dir

            # --- Download if not cached or cache loading failed --- 
            print(f"Processing artifact (cache miss or error): {artifact_full_name}")
            os.makedirs(version_download_dir, exist_ok=True)

            # Fetch and download the specific artifact version
            # Use self.api() which should be thread-safe for read operations generally
            artifact = self.api().artifact(name=artifact_full_name, type='weighted_connections') 
            artifact.download(root=version_download_dir)

            # Find the .pt file within the specific version's directory (after download)
            pt_file = None
            for filename in os.listdir(version_download_dir):
                if filename.endswith('.pt'):
                    pt_file = os.path.join(version_download_dir, filename)
                    print(f"  Found .pt file after download: {filename}")
                    break
            
            # Load the data if found
            if pt_file:
                artifact_data = torch_load(pt_file)
                print(f"  Successfully loaded and stored data for index {version_index}")
                return version_index, artifact_data
            else:
                print(f"  Warning: Pytorch (.pt) file not found in artifact {artifact_full_name} at {version_download_dir}")
                return version_index, None # Return None data if file not found
        
        except ValueError as ve:
            print(f"Error parsing version for artifact {artifact.name}: {ve}")
            return version_index, None # Return None data on error
        except wandb.errors.CommError as ce:
            print(f"Error fetching/downloading artifact {artifact.name}: {ce}")
            return version_index, None # Return None data on error
        except Exception as e:
            print(f"Unexpected error processing artifact {artifact.name}: {e}")
            return version_index, None # Return None data on error

    def find_weight_artifacts(self, run_id: str = None, project_name: str = None, entity_name: str = None, max_workers: int = None):
        """Fetch weighted connections artifacts from W&B for each step, using parallel downloads."""
        entity = entity_name or self.entity
        proj = project_name or self.project_name
        rid = run_id or self.run_id
        
        run = self.run if (rid == self.run_id) else self.fetch_run(rid, proj, entity)

        download_dir_root = os.path.join(DATA_ARTIFACT_STORE_PATH, 'weighted_connections', rid)
        os.makedirs(download_dir_root, exist_ok=True)

        logged_artifacts = list(run.logged_artifacts()) # Get all artifacts first
        print(f"Found {len(logged_artifacts)} logged artifacts for run {rid}.")

        # filter artifacts to process
        artifacts_to_process = [
            artifact for artifact in logged_artifacts 
            if "-weights:v" in artifact.name
        ]
        print(f"Found {len(artifacts_to_process)} artifacts matching the '-weights:v' convention.")

        # using ThreadPoolExecutor for parallel processing
        results = {}
        # determine max_workers, default to None (python default) if not provided
        workers = max_workers if max_workers and max_workers > 0 else None 
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
            # submit tasks
            future_to_artifact = { 
                executor.submit(self._process_artifact_version, artifact, entity, proj, rid, download_dir_root): artifact 
                for artifact in artifacts_to_process
            }

            # process completed futures
            for future in concurrent.futures.as_completed(future_to_artifact):
                artifact = future_to_artifact[future]
                try:
                    version_index, data = future.result()
                    if version_index is not None: # Check if version index could be parsed
                        results[version_index] = data # Store data or None
                except Exception as exc:
                    print(f'Artifact {artifact.name} generated an exception: {exc}')
                    # Optionally try to parse version index again to store None if possible
                    try:
                        version_str = artifact.name.split(':')[-1]
                        if version_str.startswith('v'):
                            version_index = int(version_str[1:])
                            results[version_index] = None
                    except Exception as e: 
                        print(f"Parsing version string cased an exception: {e}") # ignore if we can't even parse the version from the name

        print(f"\nFinished processing. Collected data for indices: {sorted(results.keys())}")
        self.mconf.weighted_connections = results
        return results

        