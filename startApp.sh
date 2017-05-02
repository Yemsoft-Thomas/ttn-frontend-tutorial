#! /bin/sh
#Starting the tutorial TTN Application
#Yemsoft, TF, 24-04-2017

# Stop RethinkDB if it's already running, probably pid file not cleaned up.
if [ -f rethinkdb.pid ]
then
  kill `cat ./rethinkdb.pid` 2>&1 | tee ./ttn-app.log
  rm rethinkdb.pid
  echo "INFO: Old RethinkDB instance stopped."
fi

echo "\nStarting RethinkDB ..." >&2 | tee ./ttn-app.log
rethinkdb --bind 172.24.100.10 --pid-file "./rethinkdb.pid" 2>&1 | tee ./ttn-app.log &
if [ $? -eq 0 ]
then
  # If DB started ok, start Node.js App
  sleep 3 #wait for DB to completely start
  echo "\nStarting Node.js App ..." >&2 | tee ./ttn-app.log
  node index.js 2>&1 | tee ./ttn-app.log
  if [ $? -ne 0 ]
  then
	echo "ERROR: Node.js failed!" >&2 | tee ./ttn-app.log
  fi
else
  echo "ERROR: RethinkDB not started!" >&2 | tee ./ttn-app.log
fi

