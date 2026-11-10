<%@ WebHandler Language="C#" Class="DocList" %>
using System;
using System.IO;
using System.Text;
using System.Web;

public class DocList : IHttpHandler {
    static readonly string[] Secs = { "notice", "calendar", "download" };
    static readonly string[] Exts = { ".pdf", ".doc", ".docx" };

    static string Esc(string s) {
        return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
    }

    public void ProcessRequest(HttpContext ctx) {
        ctx.Response.ContentType = "application/json; charset=utf-8";
        ctx.Response.Cache.SetCacheability(HttpCacheability.NoCache);
        ctx.Response.Cache.SetNoStore();

        string docRoot = ctx.Server.MapPath("DOC");
        if (!Directory.Exists(docRoot)) docRoot = ctx.Server.MapPath("/DOC");

        StringBuilder sb = new StringBuilder("{");
        for (int s = 0; s < Secs.Length; s++) {
            if (s > 0) sb.Append(",");
            string sec = Secs[s];
            sb.Append("\"").Append(sec).Append("\":[");
            string dir = Path.Combine(docRoot, sec);
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
        ctx.Response.Write(sb.ToString());
    }

    public bool IsReusable { get { return true; } }
}
