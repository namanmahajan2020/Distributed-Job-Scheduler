# Deployment Diagram

```mermaid
flowchart LR
  Browser[Browser]
  Nginx[Static Web Container]
  API[API Container]
  Worker1[Worker Container 1]
  Worker2[Worker Container 2]
  Postgres[(PostgreSQL Container)]

  Browser --> Nginx
  Browser --> API
  API --> Postgres
  Worker1 --> Postgres
  Worker2 --> Postgres
```
