from middleman.repository import CacheRepository
import inspect

print(inspect.signature(CacheRepository.get_history))
