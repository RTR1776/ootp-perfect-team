Report mode: portable HTML. Audience: product stakeholders.
Required sections: title, Executive Summary, findings (rules, parks, data definitions and five builds), next steps, further questions, caveats.
Chart map: Parks section — grouped bar, championship x HR factor, batting side as color, 10 rows, 1.000 neutral; supports asymmetric park effects. Tables supply exact rules, source identity, sample sizes and restrictions; a distance chart would hide eligibility constraints. No causal performance claims.
Reproduce database extraction from web with: node --env-file=.env.local --import tsx scripts/audit-ptcs6.ts
Then run this build_report.py and the Data Analytics deliver_portable_artifact.mjs command.
