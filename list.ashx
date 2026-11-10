<%@ WebHandler Language="C#" Class="DocList" %>
using System;
using System.IO;
using System.Text;
using System.Web;

public class DocList : IHttpHandler {
    static readonly string[] Secs = { "notice", "calendar", "download" };
    static readonly string[] Exts = { ".pdf", ".doc", ".docx", ".jpg", ".jpeg" };

    static string Esc(string s) {
        return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
    }

    public void ProcessRequest(HttpContext ctx) {
        ctx.Response.ContentType = "application/json; charset=utf-8";
        ctx.Response.ContentEncoding = Encoding.UTF8;
        ctx.Response.Cache.SetCacheability(HttpCacheability.NoCache);
        ctx.Response.Cache.SetNoStore();

        string docRoot = ctx.Server.MapPath("DOC");
        if (!Directory.Exists(docRoot)) docRoot = ctx.Server.MapPath("/DOC");
        string manifestPath = Path.Combine(docRoot, "manifest.json");

        // 支援從後台 (admin.html) POST 直接儲存自訂的 manifest.json
        if (ctx.Request.HttpMethod == "POST") {
            try {
                using (StreamReader sr = new StreamReader(ctx.Request.InputStream, Encoding.UTF8)) {
                    string body = sr.ReadToEnd();
                    if (string.IsNullOrWhiteSpace(body) || !body.TrimStart().StartsWith("{")) {
                        ctx.Response.StatusCode = 400;
                        ctx.Response.Write("{\"ok\":false,\"error\":\"無效的 JSON 格式\"}");
                        return;
                    }
                    File.WriteAllText(manifestPath, body, new UTF8Encoding(false));
                    ctx.Response.Write("{\"ok\":true}");
                    return;
                }
            } catch (Exception ex) {
                ctx.Response.StatusCode = 500;
                ctx.Response.Write("{\"ok\":false,\"error\":\"" + Esc(ex.Message) + "\"}");
                return;
            }
        }

        StringBuilder sb = new StringBuilder("{");
        for (int s = 0; s < Secs.Length; s++) {
            if (s > 0) sb.Append(",");
            string sec = Secs[s];
            sb.Append("\"").Append(sec).Append("\":[");
            string dir = Path.Combine(docRoot, sec);
            if (sec == "calendar" && !Directory.Exists(dir)) {
                string alt = Path.Combine(docRoot, "calender");
                if (Directory.Exists(alt)) dir = alt;
            }
            if (Directory.Exists(dir)) {
                FileInfo[] files = new DirectoryInfo(dir).GetFiles();
                bool first = true;
                foreach (FileInfo f in files) {
                    if (f.Name.StartsWith(".")) continue;
                    string ext = f.Extension.ToLowerInvariant();
                    if (Array.IndexOf(Exts, ext) < 0) continue;
                    if (!first) sb.Append(",");
                    first = false;
                    string baseName = Path.GetFileNameWithoutExtension(f.Name);
                    sb.Append("{\"name\":\"").Append(Esc(baseName))
                      .Append("\",\"file\":\"").Append(Esc(f.Name))
                      .Append("\",\"ext\":\"").Append(ext.TrimStart('.'))
                      .Append("\",\"size\":").Append(f.Length)
                      .Append(",\"date\":\"").Append(f.LastWriteTime.ToString("yyyy-MM-dd"))
                      .Append("\"}");
                }
            }
            sb.Append("]");
        }
        sb.Append("}");
        string jsonOut = sb.ToString();

        // 若帶有 ?save=1 參數，順便將掃描結果寫入 DOC/manifest.json
        if (ctx.Request.QueryString["save"] == "1") {
            try { File.WriteAllText(manifestPath, jsonOut, new UTF8Encoding(false)); } catch { }
        }

        ctx.Response.Write(jsonOut);
    }

    public bool IsReusable { get { return true; } }
}
