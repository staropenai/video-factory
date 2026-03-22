import anthropic
import srt
import json
import os

def analyze_srt(srt_path: str) -> dict:
    with open(srt_path, 'r', encoding='gbk') as f:
        subtitles = list(srt.parse(f.read()))
    
    transcript = ""
    for sub in subtitles:
        start = sub.start.total_seconds()
        end   = sub.end.total_seconds()
        transcript += f"[{start:.1f}s-{end:.1f}s] {sub.content}\n"
    
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    
    prompt = f"""你是一个视频剪辑专家。以下是纪录片字幕（带时间戳）。

任务：找出最精彩的片段，把长视频压缩成3-5分钟精华版。

选择标准：
1. 核心观点或令人惊叹的事实
2. 情感高潮或故事转折点
3. 开头hook（前30秒必须吸引人）
4. 收尾总结

字幕内容：
{transcript[:8000]}

只返回JSON，不要其他文字：
{{
  "segments": [
    {{"start": 12.5, "end": 45.0, "reason": "开头hook"}},
    {{"start": 120.0, "end": 180.5, "reason": "核心观点"}}
  ],
  "title_suggestion": "建议标题"
}}"""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )
    
    raw = message.content[0].text
    # 提取 JSON 部分（去掉 Claude 可能加的说明文字）
    import re
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not match:
        print("Claude 返回内容：", raw[:500])
        raise ValueError("未找到 JSON")
    result = json.loads(match.group())
    print(f"✅ Claude分析完成，选出 {len(result['segments'])} 个片段")
    print(f"📝 建议标题：{result['title_suggestion']}")
    return result
