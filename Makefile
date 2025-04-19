build:
	docker buildx build --platform linux/arm64 -t com.timecheck.device:latest-arm64 --load .

run-arm64:
	docker run --rm -p 3000:3000 --name timecheck --platform linux/arm64 com.timecheck.device:arm64-latest

stop:
	docker stop timecheck

rm:
	docker stop timecheck
	docker rm timecheck
