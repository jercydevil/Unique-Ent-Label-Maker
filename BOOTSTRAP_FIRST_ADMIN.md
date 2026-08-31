# Creating your first admin (one-time, manual)

`admin-create-staff` can't create the very first admin — it requires an
admin JWT to call it, which doesn't exist yet. Do this once, by hand:

### Step 1 — Create the auth user
Supabase Dashboard → Authentication → Users → **Add user**:
- Email: anything internal, e.g. `admin@staff.internal.invalid`
- Password: anything strong — it will never actually be used to log in
  (staff/admin sign in via PIN only, see `pin-login`)
- Auto Confirm User: **on**

Copy the generated **User UID** — you'll need it for Step 2.

### Step 2 — Set their app_metadata role
Same user row → Edit → App Metadata → set:
```json
{ "role": "admin" }
```

### Step 3 — Insert the matching core.staff row
Tell me:
- the display name you want (e.g. "Ishaq")
- a short staff_code (e.g. "admin1")
- a 4–6 digit PIN

and I'll generate the exact `insert into core.staff (...) values (...)`
statement with a real bcrypt hash of your PIN already computed, ready to
paste into the SQL editor along with the User UID from Step 1. I don't
need your PIN to stay secret in our conversation, but you may prefer to
pick one now and rotate it after go-live — either is fine, it's a 10-second
change either way.

### Step 4 — Set the JWT secret for pin-login
Project Settings → API → copy the **JWT Secret**, then:
```bash
supabase secrets set SUPABASE_JWT_SECRET=<paste-it-here>
```
(This is the one function secret `pin-login` needs that Supabase doesn't
auto-inject — everything else, `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`,
is provided automatically to every Edge Function.)

### Step 5 — Deploy the functions
```bash
supabase functions deploy pin-login
supabase functions deploy admin-create-staff
```

After that, logging in as the admin via `pin-login` with `staff_code` +
`pin` should return a working session JWT, and you can use
`admin-create-staff` (called with that JWT) to onboard every real staff
member from then on — no more manual dashboard steps needed.
