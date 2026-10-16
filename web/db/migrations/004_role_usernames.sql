-- Role-based login usernames (creator1…creator5, investor1…investor9, mule). The participant ID
-- (P01…) stays the internal key and the neutral public label used in the explorer, so the
-- explorer never shows which wallet belongs to which role.
ALTER TABLE participants ADD COLUMN username TEXT;

-- Backfill existing scenarios: number each role in participant-ID order.
UPDATE participants p SET username = n.username
  FROM (
    SELECT scenario_id, id,
           CASE WHEN role = 'mule' AND count(*) OVER (PARTITION BY scenario_id, role) = 1 THEN 'mule'
                ELSE role::text || row_number() OVER (PARTITION BY scenario_id, role ORDER BY id) END AS username
      FROM participants
  ) n
 WHERE n.scenario_id = p.scenario_id AND n.id = p.id;

-- Replace the old generic display names ("Participant P01") with role-based ones ("Creator 1").
UPDATE participants
   SET display_name = initcap(regexp_replace(username, '([a-z]+)([0-9]+)', '\1 \2'))
 WHERE display_name LIKE 'Participant P%';

ALTER TABLE participants ALTER COLUMN username SET NOT NULL;
ALTER TABLE participants ADD CONSTRAINT participants_username_format CHECK (username ~ '^[a-z][a-z0-9]{2,31}$');
CREATE UNIQUE INDEX participants_username_per_scenario ON participants (scenario_id, username);
