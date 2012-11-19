#!/bin/bash

set -e
cd $(dirname "${BASH_SOURCE[0]}")
DEV="$PWD"

VERSION=v0.8.2

if [ ! -f ./node/bin/node ]
then
    mkdir node
    cd node
    wget http://nodejs.org/dist/$VERSION/node-$VERSION.tar.gz
    tar xfz node-$VERSION.tar.gz
    cd node-$VERSION
    ./configure --prefix=$DEV/node
    make
    make install
    cd ..
    rm -r node-$VERSION node-$VERSION.tar.gz
    cd ..
fi

export PATH=$DEV/node/bin:$PATH
export NODE_PATH=$DEV/node/lib/node_modules

for dependency in \
    mocha requirejs should ember-metal-node ember-runtime-node jquery jsdom
do
    if [ ! -d node/lib/node_modules/$dependency ]
    then
        npm install -g $dependency
    fi
done

cd ../gobotany/static/scripts

set -x
exec mocha "$@"
