import threading
import uuid
import logging
import traceback
from backend import database
from backend.synthesis_service import train_and_generate

logger = logging.getLogger(__name__)

def run_job_worker(job_id, dataset_id, model_type, model_params, requested_rows):
    """
    Background worker thread function for running training, generation, and quality evaluation.
    """
    try:
        database.update_job_status(
            job_id=job_id,
            status="running",
            progress=5,
            message="Initializing background generation process..."
        )
        
        def progress_cb(pct, msg):
            database.update_job_status(
                job_id=job_id,
                status="running",
                progress=pct,
                message=msg
            )
            
        result = train_and_generate(
            dataset_id=dataset_id,
            model_type=model_type,
            model_params=model_params,
            requested_rows=requested_rows,
            job_id=job_id,
            progress_callback=progress_cb
        )
        
        database.update_job_status(
            job_id=job_id,
            status="completed",
            progress=100,
            message="Synthetic data successfully generated and evaluated!",
            generated_file_path=result["generated_file_path"],
            generated_rows=result["generated_rows"],
            quality_score=result["quality_score"],
            quality_report_dict=result["quality_report"]
        )
        logger.info(f"Job {job_id} completed successfully.")
        
    except Exception as e:
        error_msg = f"Generation failed: {str(e)}"
        logger.error(f"Error in job {job_id}: {error_msg}\n{traceback.format_exc()}")
        database.update_job_status(
            job_id=job_id,
            status="failed",
            progress=0,
            message=error_msg
        )

def submit_generation_job(dataset_id, model_type, model_params, requested_rows):
    """
    Register a new generation job and dispatch it to a background thread.
    """
    dataset = database.get_dataset(dataset_id)
    if not dataset:
        raise ValueError(f"Dataset {dataset_id} not found.")
        
    job_id = str(uuid.uuid4())
    dataset_name = dataset.get("original_name", "dataset.csv")
    
    database.create_job(
        job_id=job_id,
        dataset_id=dataset_id,
        dataset_name=dataset_name,
        model_type=model_type,
        model_params_dict=model_params,
        requested_rows=requested_rows
    )
    
    # Launch worker in background thread
    t = threading.Thread(
        target=run_job_worker,
        args=(job_id, dataset_id, model_type, model_params, requested_rows),
        daemon=True
    )
    t.start()
    
    return {
        "job_id": job_id,
        "dataset_id": dataset_id,
        "dataset_name": dataset_name,
        "model_type": model_type,
        "requested_rows": requested_rows,
        "status": "queued",
        "progress": 0,
        "message": "Job queued for training and generation"
    }

def get_job_info(job_id):
    job = database.get_job(job_id)
    if not job:
        raise FileNotFoundError(f"Job {job_id} not found.")
    return job
