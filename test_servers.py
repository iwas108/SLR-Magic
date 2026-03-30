import asyncio
import uvicorn
from fastapi import FastAPI

app1 = FastAPI()
app2 = FastAPI()

@app1.get("/")
def read_root():
    return {"app": "1"}

@app2.get("/")
def read_root2():
    return {"app": "2"}

async def main():
    config1 = uvicorn.Config(app1, host="0.0.0.0", port=8000, log_level="error")
    server1 = uvicorn.Server(config1)
    config2 = uvicorn.Config(app2, host="0.0.0.0", port=8899, log_level="error")
    server2 = uvicorn.Server(config2)

    task1 = asyncio.create_task(server1.serve())
    task2 = asyncio.create_task(server2.serve())

    await asyncio.gather(task1, task2)

if __name__ == "__main__":
    asyncio.run(main())
