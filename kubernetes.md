-- ds.page: Kubernetes

-- ft.h1: Pod

Pod is an individual "node" which runs service. On one pod one or more "containers" can run. 
Mostly one container. 

If more than one the rest are called "sidecars". 

There is a concept of "init containers" vs "app containers", where init containers run before
app containers starts.

-- end: ds.page
