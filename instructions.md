Credits to: (Ramiro Linares)[https://github.com/RamiroLinares]

VAGRANT_VAGRANTFILE=Vagrantfile.CI vagrant ssh dev-1

sudo mkdir /docker-entrypoint-initdb.d
"python3 -m http.server 3000"
wget http://iphost:3000/db*schema.sql
wget http://iphost:3000/db_schema2.sql
(info postgres https://hub.docker.com/*/postgres)

docker images
docker run -e POSTGRES_HOST_AUTH_METHOD=trust postgres:latest
docker exec -it postgresCointanerId bash
su postgres
psql
...
(https://stackoverflow.com/questions/34688465/how-do-i-run-a-sql-file-of-inserts-through-docker-run)

(inside directory)
docker cp ./db_schema.sql nameContainer:/docker-entrypoint-initdb.d/db_schema.sql
docker exec -u postgres nameContainer psql postgres postgres -f docker-entrypoint-initdb.d/db_schema.sql
docker run jalafoundation/dose-main-server:latest
docker run jalafoundation/dose-content-server:latest

docker run -d -p 5432:5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:latest
docker run -d -p 3000:3000 jalafoundation/dose-main-server:latest
docker run -d -p 3001:3001 jalafoundation/dose-content-server

docker ps --all

docker cp ./db_schema.sql beautiful_jemison:/docker-entrypoint-initdb.d/db_schema.sql
docker exec -u postgres beautiful_jemison psql dose postgres -f docker-entrypoint-initdb.d/db_schema.sql

docker exec -it dc8a1e12bf9d bash
su postgres
psql
CREATE DATABASE dose;
CREATE DATABASE MovieServer;
172.17.0.1 10.0.10.11
INSERT INTO server (server_id,server_ip,server_name) VALUES (1,'172.17.0.1', 'dose');
INSERT INTO users (username,password,salt,email,id) VALUES ('25ramy','linares25','salt','ramirolinares_09@hotmail.com',1);
INSERT INTO user_server (user_id,server_id) VALUES (1,1);
