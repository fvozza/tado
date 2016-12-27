# TADO Logger

## Use ENV variables for credentials

```
export TADO_LOGIN="your email"
export TADO_PASSWORD="your password"

```

## Docker image

```
docker pull fvozza/tado
docker run -e TADO_LOGIN="your email" -e TADO_PASSWORD="your password" fvozza/tado
```
