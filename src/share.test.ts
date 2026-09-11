/**
 * 分享模块回归测试：只读链接是产品「确定性回放」承诺的关键路径。
 * 编解码任何字段丢失/损坏都会导致回放结果与原结果不一致，必须护栏。
 */
import { describe, expect, it } from 'vitest';
import { buildShareUrl, decodeShare, encodeShare, parseShareFromHash, type ShareDoc } from './share';

const sampleDoc: ShareDoc = {
  v: 1,
  name: '张三',
  gender: 'male',
  calendarType: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  hour: 14,
  minute: 30,
  useTimeIndex: false,
  timeIndex: 0,
  locName: '北京',
  lng: 116.4074,
  lat: 39.9042,
  tz: 8,
  useTrueSolarTime: true,
  applyChinaDst: false,
  topic: 'career',
  qtext: '今年适合换工作吗？',
  schools: { tarot: 'off', meihua: 'on' },
  seed: 12345,
  seedMode: 'question',
  askedAt: { year: 2026, month: 9, day: 3, hour: 21, minute: 45, second: 12 },
};

describe('share 编解码', () => {
  it('roundtrip：所有字段（含 schools/askedAt/seedMode）逐字段保留', () => {
    const payload = encodeShare(sampleDoc);
    const back = decodeShare(payload);
    expect(back).not.toBeNull();
    expect(back).toEqual(sampleDoc);
  });

  it('中文字段经过 base64url 后不乱码', () => {
    const back = decodeShare(encodeShare(sampleDoc));
    expect(back?.name).toBe('张三');
    expect(back?.qtext).toBe('今年适合换工作吗？');
    expect(back?.locName).toBe('北京');
  });

  it('损坏/非法 payload 返回 null 而非抛错', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('!!!not-base64!!!')).toBeNull();
    expect(decodeShare('YWJjZGVm')).toBeNull(); // 合法 base64，但不是 ShareDoc
  });

  it('buildShareUrl 生成 #/r= 前缀链接，且可被 parseShareFromHash 还原', () => {
    const url = buildShareUrl(sampleDoc);
    expect(url).toMatch(/#\/r=[A-Za-z0-9_-]+$/);
    // jsdom 下直接设置 hash 再解析
    const hash = url.slice(url.indexOf('#'));
    window.location.hash = hash;
    const doc = parseShareFromHash();
    expect(doc).toEqual(sampleDoc);
    // 清理，避免污染其他测试
    window.location.hash = '';
  });

  it('URL 安全：payload 不含 + / = 等需要转义的字符', () => {
    const payload = encodeShare(sampleDoc);
    expect(payload).toMatch(/^[A-Za-z0-9_-]*$/);
  });
});
