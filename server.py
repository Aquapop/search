#!/usr/bin/env python
"""
简易HTTP服务器启动脚本
解决浏览器CORS和本地文件访问问题

使用方法：
1. 双击运行此文件
2. 在浏览器中访问 http://localhost:8000
"""

import http.server
import socketserver
import webbrowser
import os
import sys
from threading import Timer

# 配置参数
PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """添加CORS头的HTTP请求处理器"""
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        return super().end_headers()
    
    def log_message(self, format, *args):
        """覆盖日志格式，使其更易读"""
        sys.stderr.write("\033[92m[%s] %s\033[0m\n" % (self.log_date_time_string(), format % args))

def open_browser():
    """打开浏览器访问服务器"""
    webbrowser.open(f'http://localhost:{PORT}/index.html')

def main():
    """主函数"""
    os.chdir(DIRECTORY)
    
    handler = CORSHTTPRequestHandler
    
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        # 打印访问URL
        print("\n" + "="*60)
        print(f"🚀 期刊检索工具 - 本地服务器已启动")
        print(f"📝 请访问: http://{httpd.server_address[0]}:{httpd.server_address[1]}/index.html")
        print("="*60 + "\n")
        
        # 延迟1秒后自动打开浏览器
        Timer(1, open_browser).start()
        
        try:
            # 启动服务器
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n😊 服务器已停止，感谢使用！")
            httpd.server_close()

if __name__ == "__main__":
    main() 