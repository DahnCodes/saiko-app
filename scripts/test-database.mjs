// Isolated PostgreSQL semantics via PGlite; never connects to a live database.
import assert from 'node:assert/strict'
import fs from 'node:fs'
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
let checks = 0
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`) }
const one = '11111111-1111-4111-8111-111111111111'
const two = '22222222-2222-4222-8222-222222222222'
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;`)
  const migrations = fs.readdirSync('supabase/migrations').filter(x => x.endsWith('.sql')).sort()
  await check(`apply all ${migrations.length} migrations from scratch`, async () => {
    for (const file of migrations) await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'))
  })
  await db.exec(`insert into auth.users values ('${one}'), ('${two}');
    insert into public.profiles (id, username) values ('${one}', 'first_user'), ('${two}', 'second_user');
    insert into public.anime (anilist_id, title) values (20, 'Naruto'), (21, 'One Piece'), (269, 'Bleach'), (999, 'Other');`)
  const starters = (await db.query('select id from public.anime where anilist_id in (20,21,269) order by anilist_id')).rows.map(r => r.id)
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${one}', false);`)
  await check('profiles expose only the current user', async () => assert.deepEqual((await db.query('select username from profiles')).rows, [{ username: 'first_user' }]))
  await check('cannot create another user profile', async () => assert.rejects(db.query('insert into profiles(id,username) values ($1,$2)', [two, 'spoofed']), /row-level security/))
  await check('atomically save three distinct starter favorites', async () => {
    await db.query('select save_my_favorites($1::uuid[])', [starters])
    assert.equal((await db.query('select * from user_favorite_anime')).rows.length, 3)
  })
  await check('invalid replacement keeps previous favorites', async () => {
    for (const ids of [[], starters.slice(0,2), [starters[0], starters[0], starters[1]], null]) {
      await assert.rejects(db.query('select save_my_favorites($1::uuid[])', [ids]), /exactly three/)
      assert.equal((await db.query('select * from user_favorite_anime')).rows.length, 3)
    }
  })
  await check('onboarding RPC returns current profile and favorite count', async () => {
    const result = (await db.query('select get_my_onboarding_state() as state')).rows[0].state
    assert.equal(result.profile.username, 'first_user'); assert.equal(result.favorite_count, 3)
  })
  await check('users can publish and update only their own public DNA', async () => {
    await db.exec("insert into public_anime_dna values ('first_user','Soul','icon','description','[]','{}',now()); update public_anime_dna set description='updated' where username='first_user';")
    await assert.rejects(db.exec("insert into public_anime_dna values ('second_user','Soul','icon','description','[]','{}',now())"), /row-level security/)
  })
  await check('signed-in users cannot poison shared trait cache', async () => assert.rejects(db.exec("insert into anime_traits(anilist_id) values (20)"), /permission denied/))
  await check('user recommendation cache is private', async () => {
    await db.query("insert into user_recommendations(user_id,recommendations) values ($1,'[]')", [one])
    await assert.rejects(db.query("insert into user_recommendations(user_id,recommendations) values ($1,'[]')", [two]), /row-level security/)
    await db.exec(`select set_config('request.jwt.claim.sub', '${two}', false)`)
    assert.equal((await db.query('select * from user_recommendations')).rows.length, 0)
    assert.equal((await db.query('select * from user_favorite_anime')).rows.length, 0)
    assert.equal((await db.query("update public_anime_dna set description='hijacked' where username='first_user' returning username")).rows.length, 0)
  })
  await db.exec("set role anon; select set_config('request.jwt.claim.sub', '', false)")
  await check('anonymous users can read catalog and public DNA but cannot read private rows', async () => {
    assert.equal((await db.query('select * from anime')).rows.length, 4)
    assert.equal((await db.query('select * from public_anime_dna')).rows.length, 1)
    for (const table of ['profiles','user_favorite_anime','user_recommendations']) assert.equal((await db.query(`select * from ${table}`)).rows.length, 0)
  })
  await check('anonymous users cannot call account RPCs or publish DNA', async () => {
    await assert.rejects(db.query('select save_my_favorites($1::uuid[])', [starters]), /permission denied/)
    await assert.rejects(db.exec('select get_my_onboarding_state()'), /permission denied/)
    await assert.rejects(db.exec("insert into public_anime_dna values ('intruder','x','x','x','[]','{}',now())"), /row-level security/)
  })
  await db.exec('set role service_role')
  await check('trusted service role can write shared trait cache', async () => {
    await db.exec('insert into anime_traits(anilist_id) values (20)')
    assert.equal((await db.query('select * from anime_traits')).rows.length, 1)
  })
  console.log(`${checks} database checks passed`)
} finally { await db.close() }
