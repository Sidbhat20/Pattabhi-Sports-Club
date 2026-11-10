import { describe, it, expect } from 'vitest';
import fx from './__fixtures__/club.json';
import { answer } from './ask.js';
import { netFor } from './data.js';
import { rupees } from './format.js';

// Fixed "today" so the results do not change with the calendar. Data is the sample club data fixture.
const now = new Date(2026, 10, 10);
const today = '2026-11-10';
const data = fx.data;
const ctx = {
  data,
  now,
  today,
  loadMonth: async (m) => new Map((fx.attendance[m] || []).map(([d, t, id, st]) => [`${d}|${t}|${id}`, st])),
};
const ask = (q) => answer(q, ctx);
const activeStudents = data.students.filter((s) => s.status === 'active');
// The sample data may not have three students with the same first name, so the test uses the first name that is shared most.
const firstCounts = {};
activeStudents.forEach((s) => (firstCounts[s.name.split(' ')[0]] = (firstCounts[s.name.split(' ')[0]] || 0) + 1));
const SHARED = Object.keys(firstCounts).sort((a, b) => firstCounts[b] - firstCounts[a])[0];
const manojs = activeStudents.filter((s) => s.name.split(' ')[0] === SHARED);

describe('club assistant, against the sample data', () => {
  it('Who is absent today? lists the counts and the absent students', async () => {
    const r = await ask('Who is absent today?');
    const absent = (fx.attendance['2026-11'] || []).filter(([d, t, , st]) => d === today && t === 'student' && st === 'absent').length;
    expect(r.text).not.toMatch(/sorry/i);
    expect(r.text).toMatch(/of \d+ present/);
    expect(r.text).toContain(`Absent: ${absent}`);
  });

  it('How many students do we have? gives the total and the count per batch', async () => {
    const r = await ask('How many students do we have?');
    expect(r.text).toContain(`We have ${activeStudents.length} active students.`);
    for (const b of data.batches) expect(r.text).toContain(`${b.name}:`);
  });

  it('How much does <first name> owe? never guesses between students with that name, and asks which one', async () => {
    expect(manojs.length).toBeGreaterThan(1);
    const r = await ask(`How much does ${SHARED} owe?`);
    expect(r.text).not.toMatch(/sorry/i);
    expect(r.text).toContain(`There are ${manojs.length} students called ${SHARED}`);
    expect(r.chips.map((c) => c.label)).toEqual(manojs.map((s) => s.name));
    expect(r.chips[0].send).toContain(manojs[0].name);
  });

  it('a full name answers for that one student', async () => {
    const reddy = manojs[1];
    const r = await ask(`How much does ${reddy.name} owe?`);
    expect(r.chips).toBeUndefined();
    expect(r.text.startsWith(`${reddy.name} owes`) || r.text.startsWith(`${reddy.name} has paid in full`)).toBe(true);
  });

  it('Is Shridhar paid? gives the coach pay status for the month', async () => {
    const r = await ask('Is Shridhar paid?');
    expect(r.text).toContain('Shridhar, November 2026');
    expect(r.text).toContain('Pay for November 2026:');
  });

  it("Good Morning Sir, show fees gives this month's fee summary", async () => {
    const r = await ask('Good Morning Sir, show fees');
    expect(r.text).not.toMatch(/could not find/i);
    expect(r.text).toContain('fees for November 2026');
    expect(r.text).toContain('Billed:');
  });

  it('Last month fees collected says October 2026', async () => {
    const r = await ask('Last month fees collected');
    expect(r.text).toContain('October 2026');
    expect(r.text).toContain('Fees collected for October 2026:');
  });

  it("What's our profit? shows the expected net while coach pay is due", async () => {
    const r = await ask("What's our profit?");
    const net = netFor(data, ['2026-11']);
    expect(r.text).toContain(`Net so far: ${rupees(net.net)}`);
    if (net.due > 0) {
      expect(r.text).toContain('Expected net after unpaid coach pay');
      expect(r.text).toContain(`still due to ${net.dueCoaches.join(', ')}`);
    } else {
      expect(r.text).not.toContain('Expected net');
    }
  });

  it('who is absent in U13 filters attendance to the batch', async () => {
    const r = await ask('who is absent in U13');
    expect(r.text).not.toMatch(/sorry/i);
    expect(r.text).toContain('U13');
    expect(r.text).toContain('Absent:');
  });

  it('U18 kitna baaki hai (Hinglish) lists what U18 still owes', async () => {
    const r = await ask('U18 kitna baaki hai');
    expect(r.text).not.toMatch(/sorry/i);
    expect(r.text.startsWith('Everyone') || /students still owe/.test(r.text)).toBe(true);
    expect(r.text).toMatch(/U18|\(U18\)|Everyone in U18/);
  });

  it('typos still work: attendence and fess and studnets', async () => {
    expect((await ask('todays attendence')).text).toContain('present');
    expect((await ask('fess this month')).text).toContain('fees for November 2026');
    expect((await ask('how many studnets')).text).toContain('active students');
  });

  it('a question it cannot answer offers example questions instead of a bare sorry', async () => {
    const r = await ask('can we send a message');
    expect(r.chips.length).toBe(4);
    expect(r.text).not.toMatch(/sorry/i);
  });

  it('an unknown full name is reported, not matched to someone else', async () => {
    const r = await ask('How much does Zara Quazi owe?');
    expect(r.text).toMatch(/could not find a student called Zara Quazi/);
  });
});
