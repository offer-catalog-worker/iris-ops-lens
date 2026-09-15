ARG IMAGE=containers.intersystems.com/intersystems/iris-community:latest-em
FROM $IMAGE

WORKDIR /home/irisowner/irisbuild
USER root
RUN apt-get update && apt-get -y install git && rm -rf /var/lib/apt/lists/*
USER ${ISC_PACKAGE_MGRUSER}

ARG TESTS=0
ARG MODULE="iris-ops-lens"
ARG NAMESPACE="IRISOPS"

RUN --mount=type=bind,src=.,dst=. \
    iris start IRIS && \
    iris session IRIS < iris.script && \
    ([ $TESTS -eq 0 ] || iris session IRIS -U $NAMESPACE "##class(%ZPM.PackageManager).Shell(\"test $MODULE -v\",1,1)") && \
    summary="$(iris session IRIS -U $NAMESPACE < tests/iris-smoke.script)" && \
    printf '%s\n' "$summary" | grep -Eq '"readOnly"[[:space:]]*:[[:space:]]*true' && \
    printf '%s\n' "$summary" | grep -Eq '"authenticated"[[:space:]]*:[[:space:]]*(true|false)' && \
    printf '%s\n' "$summary" | grep -Eq '"secretsExposed"[[:space:]]*:[[:space:]]*false' && \
    iris stop IRIS quietly
