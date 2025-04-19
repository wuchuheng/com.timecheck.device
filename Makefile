build:
	rm -rf node_modules
	docker buildx build --platform linux/arm64 -t com.timecheck.device:latest-arm64 --load .
	# docker buildx build --platform linux/amd64 -t com.timecheck.device:amd64-latest --load .
run-arm64:
	docker run --rm -p 3000:3000 --name timecheck --platform linux/arm64 com.timecheck.device:arm64-latest

run-amd64:
	docker run --rm -p 3000:3000 --name timecheck --platform linux/amd64 com.timecheck.device:amd64-latest

stop:
	docker stop timecheck

rm:
	docker rm timecheck
