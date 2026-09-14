ARG IMAGE=intersystemsdc/iris-community
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
    iris stop IRIS quietly
