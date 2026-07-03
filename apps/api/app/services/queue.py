from arq import create_pool
from arq.connections import RedisSettings


async def enqueue_ingest_job(redis_url: str, job_id: str) -> str:
    redis = await create_pool(RedisSettings.from_dsn(redis_url))
    try:
        job = await redis.enqueue_job("run_ingest_job", job_id)
        if not job:
            raise RuntimeError("Failed to enqueue ingest job")
        return job.job_id
    finally:
        await redis.aclose()


async def enqueue_health_scan(redis_url: str, job_id: str) -> str:
    redis = await create_pool(RedisSettings.from_dsn(redis_url))
    try:
        job = await redis.enqueue_job("run_health_scan", job_id)
        if not job:
            raise RuntimeError("Failed to enqueue health scan")
        return job.job_id
    finally:
        await redis.aclose()
