#!/bin/sh
# 배포할 때마다 실행: 브라우저가 옛 파일을 쓰지 않도록 파일 주소에 버전을 붙임
V=$(date +%Y%m%d%H%M%S)
sed -i -E "s#(style\.css|app\.js)(\?v=[0-9]+)?\"#\1?v=$V\"#g" index.html
sed -i -E "s#\./(stage|config)\.js(\?v=[0-9]+)?\"#./\1.js?v=$V\"#g" app.js
echo "version $V"
