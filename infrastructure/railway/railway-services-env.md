# Railway Services Environment Variables Reference
# HVAC ERP Production Deployment

---

## 1. Service: MongoDB
Place in Railway Service: `MongoDB` -> Tab: `Variables` -> `RAW Editor`

```env
MONGO_INITDB_DATABASE=hvac_erp
MONGO_INITDB_ROOT_USERNAME=mongo
MONGO_INITDB_ROOT_PASSWORD=hvac_mongo_secret_password_2026
```

---

## 2. Service: Redis
Place in Railway Service: `Redis` -> Tab: `Variables` -> `RAW Editor`

```env
REDISUSER=default
REDISPASSWORD=xiaeeZCGngcJNpJKDTCdQSEYvoKKeMDN
REDISPORT=6379
```

---

## 3. Service: RabbitMQ
Place in Railway Service: `rabbitmq` -> Tab: `Variables` -> `RAW Editor`

```env
RABBITMQ_DEFAULT_USER=hvac_admin
RABBITMQ_DEFAULT_PASS=hvac_secret_123
```

---

## 4. Service: HVAC (Project Backend)
Place in Railway Service: `HVAC` -> Tab: `Variables` -> `RAW Editor`

```env
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Private Network Database Connections
MONGO_URI=${{ MongoDB.MONGO_PRIVATE_URL }}
REDIS_URI=redis://default:xiaeeZCGngcJNpJKDTCdQSEYvoKKeMDN@redis.railway.internal:6379
RABBITMQ_URL=amqp://hvac_admin:hvac_secret_123@rabbitmq.railway.internal:5672

# Security & Tokens
JWT_SECRET=super-secret-production-jwt-key-64-characters-minimum-hvac
JWT_EXPIRES_IN=1d
REFRESH_TOKEN_EXPIRES_IN=7d
INTERNAL_SERVICE_SECRET=super-secret-production-internal-token-key-64-chars

# Internal Microservices Ports
IDENTITY_SERVICE_PORT=4001
INVENTORY_SERVICE_PORT=4002
PURCHASING_SERVICE_PORT=4003
CUSTOMER_SERVICE_PORT=4004
SALES_SERVICE_PORT=4005
INSTALLMENT_SERVICE_PORT=4006
FINANCE_SERVICE_PORT=4007
TECHNICIAN_SERVICE_PORT=4008
SERVICE_OPERATIONS_SERVICE_PORT=4009
APPROVAL_SERVICE_PORT=4010
NOTIFICATION_SERVICE_PORT=4011
AUDIT_SERVICE_PORT=4012
REPORTING_SERVICE_PORT=4013
```
