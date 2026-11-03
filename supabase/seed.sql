-- Fictional Tasman Hearing: an independent hearing practice with a clinic on the Gold
-- Coast (Australia, Hearing Services Program provider) and one in Auckland (New Zealand),
-- four clinicians and sixteen clients. Dated relative to today so there is always
-- something to chase. Idempotent: running it twice changes nothing and never resets later edits.

insert into settings(key,value,unit,note) values
 ('recall_months',12,'months','A client is due a hearing review this long after their last test. House setting.'),
 ('test_valid_months',12,'months','A fitting needs a hearing test this recent. House setting.'),
 ('hsp_replacement_years',5,'years','Hearing Services Program: a refitting needs no fitting claimed for that ear in this many years, unless the aid was lost or damaged beyond repair. See docs/compliance.md.'),
 ('nz_funding_years',6,'years','NZ Hearing Aid Subsidy, Hearing Aid Funding Scheme and ACC: one funded aid per ear in this many years. See docs/compliance.md.'),
 ('retention_years_au',7,'years','AU: keep client records this long after the last service (HSP Schedule s21, state health records acts).'),
 ('retention_years_nz',10,'years','NZ: keep health records this long after the last service (Health (Retention of Health Information) Regulations 1996).'),
 ('upgrade_years',4,'years','Privately paying clients are offered new aids this long after their last ones. House setting.'),
 ('follow_up_days',14,'days','Every fitting has a follow-up attended within this many days. House setting.'),
 ('trial_days',30,'days','Length of a hearing aid trial unless set on the fitting. House setting.'),
 ('claim_lodge_days',30,'days','Lodge a funder claim within this many days of the service. House setting; check your funder contract.'),
 ('claim_paid_days',30,'days','Chase a lodged claim not paid after this many days.'),
 ('repair_days',21,'days','Chase a repair away at the manufacturer longer than this.'),
 ('debtor_days',30,'days','An invoice this many days past due is overdue.'),
 ('unfitted_days',14,'days','Chase a client tested with a loss worth fitting and nothing since, after this many days.')
on conflict (key) do nothing;

insert into clinics(code,name,country,address) values
 ('GC','Tasman Hearing Gold Coast','AU','12 Marine Parade, Southport QLD 4215'),
 ('AKL','Tasman Hearing Auckland','NZ','88 Dominion Road, Mt Eden, Auckland 1024')
on conflict (code) do nothing;

insert into clinicians(code,name,role,registration_no,registration_expiry,hsp_qualified,email) values
 ('MR','Mia Rossi','audiologist','AudA-40211',current_date+200,true,'mia@tasmanhearing.example'),
 ('JT','James Tan','audiometrist','ACAud-1187',current_date-10,true,'james@tasmanhearing.example'),
 ('AW','Aroha Walker','audiologist','NZAS-3302',current_date+300,false,'aroha@tasmanhearing.example'),
 ('PS','Priya Shah','audiologist','NZAS-2875',current_date+40,false,'priya@tasmanhearing.example')
on conflict (code) do nothing;

insert into clients(code,name,dob,phone,email,clinic_id,clinician_id,funder,referral_source,gp_name,consent_on,created_on)
select v.code,v.name,v.dob::date,v.phone,v.email,k.id,cl.id,v.funder,v.ref,v.gp,current_date+v.consent,current_date+v.created
from (values
 ('C1001','Margaret Ellis','1946-03-14','0412 330 118','m.ellis@example.com','GC','MR','hsp','GP','Dr Patel',-30,-60),
 ('C1002','Graham Hollis','1958-07-02','0419 220 674','graham.h@example.com','GC','MR','private','Website',null,-45,-70),
 ('C1003','Susan Doyle','1961-11-23','0402 778 210','sdoyle@example.com','GC','JT','private','GP','Dr Patel',-40,-45),
 ('C1004','Ken Watanabe','1949-05-30','0433 118 905',null,'GC','MR','hsp','Returning client','Dr Lim',-800,-1600),
 ('C1005','Beryl Thompson','1940-01-17','0755 310 442',null,'GC','MR','hsp','Returning client','Dr Lim',-2010,-2100),
 ('C1006','Dennis Kerr','1952-09-09','0421 660 391','dkerr@example.com','GC','JT','hsp','Hearing Australia referral','Dr Patel',-1100,-1200),
 ('C1007','Lorraine Price','1944-12-01','0408 551 237',null,'GC','MR','hsp','Newspaper','Dr Lim',-55,-80),
 ('C1008','Peter Novak','1950-04-26','0411 902 334','pnovak@example.com','GC','MR','hsp','GP','Dr Patel',-20,-25),
 ('C1009','Hemi Parata','1963-08-15','021 448 902','hemi.p@example.co.nz','AKL','AW','private','Website',null,null,-30),
 ('C1010','Fiona McLeod','1971-02-11','027 330 118','fiona.m@example.co.nz','AKL','AW','private','Facebook',null,null,-14),
 ('C1011','Bruce Taylor','1959-06-04','021 776 540','btaylor@example.co.nz','AKL','PS','acc','ACC referral','Dr Ngata',-20,-40),
 ('C1012','Ana Fifita','1955-10-19','022 309 117','ana.f@example.co.nz','AKL','AW','msd','Work and Income','Dr Ngata',-1500,-1600),
 ('C1013','Robert Chen','1948-03-03','0414 228 761','rchen@example.com','GC','MR','private','Returning client','Dr Lim',-1100,-2000),
 ('C1014','Janet O''Brien','1953-07-27','027 118 404',null,'AKL','PS','private','GP','Dr Ngata',-415,-420),
 ('C1015','Colin Fraser','1960-12-12','0400 315 882','cfraser@example.com','GC','JT','private','Website',null,-90,-100),
 ('C1016','Dorothy Wills','1947-09-21','0755 662 019',null,'GC','JT','hsp','GP','Dr Patel',-3,-5)
) v(code,name,dob,phone,email,clinic,clin,funder,ref,gp,consent,created)
join clinics k on k.code = v.clinic join clinicians cl on cl.code = v.clin
on conflict (code) do nothing;

insert into vouchers(code,client_id,issued_on,expires_on)
select v.code,c.id,current_date+v.i,current_date+v.i+1826 from (values
 ('V-88120','C1001',-70),
 ('V-50211','C1004',-1700),
 ('V-31002','C1005',-2100),
 ('V-61190','C1005',-270),
 ('V-70456','C1006',-1250),
 ('V-55901','C1007',-1926),
 ('V-80233','C1008',-1796),
 ('V-89004','C1016',-10)
) v(code,client,i) join clients c on c.code = v.client
on conflict (code) do nothing;

insert into approvals(code,client_id,funder,approved_on,amount,note)
select v.code,c.id,v.funder,current_date+v.d,v.amount,v.note from (values
 ('MSD-2021-114','C1012','msd',-1470,1022.22,'Hearing Aid Subsidy, both ears'),
 ('MSD-2026-090','C1012','msd',-35,511.11,'Hearing Aid Subsidy, left ear')
) v(code,client,funder,d,amount,note) join clients c on c.code = v.client
on conflict (code) do nothing;

insert into products(code,brand,model,kind,tier,price,warranty_months) values
 ('SV9','Sonora','Vivid 9','aid','premium',3950,48),
 ('SV5','Sonora','Vivid 5','aid','mid',2650,36),
 ('KF7','Kiri','Fit 7','aid','mid',2400,36),
 ('KB2','Kiri','Basic 2','aid','entry',0,36),
 ('STV','Sonora','TV Streamer','accessory',null,390,24),
 ('KCH','Kiri','Charging case','charger',null,180,12)
on conflict (code) do nothing;

insert into tests(code,client_id,clinician_id,tested_on,l500,l1000,l2000,l4000,r500,r1000,r2000,r4000,recommendation,note)
select v.code,c.id,cl.id,current_date+v.d,v.l1,v.l2,v.l3,v.l4,v.r1,v.r2,v.r3,v.r4,v.rec,v.note from (values
 ('T5001','C1001','MR',-30,35,40,55,65,30,40,50,60,'fit','Struggles in groups and on the phone.'),
 ('T5002','C1002','MR',-42,25,35,50,60,25,30,45,60,'fit','High-frequency loss, wants discreet aids.'),
 ('T5003','C1003','JT',-40,35,45,50,60,40,45,55,65,'fit','Thinking about it, cost a concern.'),
 ('T5020','C1004','MR',-815,40,45,55,65,40,45,50,65,'fit',null),
 ('T5021','C1005','MR',-2030,45,50,60,70,45,50,55,70,'fit',null),
 ('T5022','C1013','MR',-1085,30,35,45,55,30,35,45,55,'fit',null),
 ('T5004','C1004','MR',-400,45,50,60,70,40,50,55,70,'review','Aids working well.'),
 ('T5005','C1005','MR',-200,50,55,65,75,50,55,60,75,'review','Aids over five years old, asked about new ones.'),
 ('T5006','C1006','JT',-1130,35,45,55,65,35,40,50,60,'fit',null),
 ('T5007','C1006','JT',-65,40,50,60,70,40,45,55,65,'fit','Wants a rechargeable right aid.'),
 ('T5008','C1007','MR',-60,40,45,55,70,45,50,60,70,'fit',null),
 ('T5009','C1008','MR',-380,30,35,45,55,30,35,45,55,'review',null),
 ('T5010','C1009','AW',-500,30,40,50,60,35,40,50,65,'fit',null),
 ('T5011','C1010','AW',-10,30,35,45,55,25,35,45,50,'fit','Teacher, noisy classroom.'),
 ('T5012','C1011','PS',-35,30,40,60,75,35,45,65,75,'fit','Noise-induced, 30 years in a sawmill.'),
 ('T5013','C1012','AW',-1500,40,50,60,70,40,45,55,65,'fit',null),
 ('T5014','C1012','AW',-40,50,55,65,75,45,50,60,70,'fit','Left ear worse than last time.'),
 ('T5015','C1013','MR',-380,35,40,50,60,35,40,50,60,'review',null),
 ('T5016','C1013','MR',-10,45,55,60,70,40,50,60,70,'fit','Hearing has dropped since last year.'),
 ('T5017','C1014','PS',-410,30,35,45,55,30,35,40,55,'review',null),
 ('T5018','C1015','JT',-95,25,35,45,55,25,30,45,55,'fit',null),
 ('T5019','C1016','JT',-3,35,40,50,60,35,45,50,60,'fit','New to aids.')
) v(code,client,clin,d,l1,l2,l3,l4,r1,r2,r3,r4,rec,note)
join clients c on c.code = v.client join clinicians cl on cl.code = v.clin
on conflict (code) do nothing;

insert into devices(code,client_id,product_id,ear,serial,funder,clinician_id,fitted_on,trial_ends,outcome,decided_on,return_reason,warranty_until,price)
select v.code,c.id,p.id,v.ear,v.serial,v.funder,cl.id,current_date+v.f,current_date+v.t,v.outcome,current_date+v.dec,v.why,current_date+v.w,v.price
from (values
 ('D3001','C1001','KB2','L','KB2-77810','hsp','MR',-24,6,'trial',null,null,1071,0),
 ('D3002','C1001','KB2','R','KB2-77811','hsp','MR',-24,6,'trial',null,null,1071,0),
 ('D3003','C1002','SV9','L','SV9-30551','private','MR',-40,-10,'trial',null,null,1420,3950),
 ('D3004','C1002','SV9','R','SV9-30552','private','MR',-40,-10,'trial',null,null,1420,3950),
 ('D3005','C1004','KF7','L','KF7-11234','hsp','MR',-800,-770,'kept',-770,null,295,0),
 ('D3006','C1004','KF7','R','KF7-11235','hsp','MR',-800,-770,'kept',-770,null,295,0),
 ('D3007','C1005','KB2','L','KB2-20981','hsp','MR',-2010,-1980,'kept',-1980,null,-915,0),
 ('D3008','C1005','KB2','R','KB2-20982','hsp','MR',-2010,-1980,'kept',-1980,null,-915,0),
 ('D3009','C1006','KB2','L','KB2-40332','hsp','JT',-1100,-1070,'kept',-1070,null,-5,0),
 ('D3010','C1006','KB2','R','KB2-40333','hsp','JT',-1100,-1070,'replaced',-60,'Wanted a rechargeable aid',-5,0),
 ('D3011','C1006','KB2','R','KB2-88120','hsp','JT',-60,-30,'kept',-30,null,1035,0),
 ('D3012','C1007','KF7','L','KF7-50114','hsp','MR',-50,-20,'kept',-20,null,1045,0),
 ('D3013','C1007','KF7','R','KF7-50115','hsp','MR',-50,-20,'kept',-20,null,1045,0),
 ('D3014','C1009','SV5','L','SV5-61022','private','AW',-20,10,'trial',null,null,1075,2650),
 ('D3015','C1011','SV5','L','SV5-61190','acc','PS',-12,18,'trial',null,null,1080,2650),
 ('D3016','C1011','SV5','R','SV5-61191','acc','PS',-12,18,'trial',null,null,1080,2650),
 ('D3017','C1012','KF7','L','KF7-30019','msd','AW',-1460,-1430,'replaced',-30,'Hearing changed',-365,2400),
 ('D3018','C1012','KF7','R','KF7-30020','msd','AW',-1460,-1430,'kept',-1430,null,-365,2400),
 ('D3019','C1012','SV5','L','SV5-70881','msd','AW',-30,0,'kept',0,null,1065,2650),
 ('D3020','C1013','SV5','L','SV5-10045','private','MR',-1070,-1040,'kept',-1040,null,25,2650),
 ('D3021','C1013','SV5','R','SV5-10046','private','MR',-1070,-1040,'kept',-1040,null,25,2650),
 ('D3022','C1013','STV','-','STV-2210','private','MR',-1070,null,'kept',-1070,null,-340,390),
 ('D3023','C1014','KF7','L','KF7-41870','private','PS',-410,-380,'kept',-380,null,685,2400),
 ('D3024','C1014','KF7','R','KF7-41871','private','PS',-410,-380,'kept',-380,null,685,2400),
 ('D3025','C1015','SV9','L','SV9-29874','private','JT',-90,-60,'returned',-62,'Too much whistling, felt blocked',1370,3950),
 ('D3026','C1015','SV9','R','SV9-29875','private','JT',-90,-60,'returned',-62,'Too much whistling, felt blocked',1370,3950)
) v(code,client,product,ear,serial,funder,clin,f,t,outcome,dec,why,w,price)
join clients c on c.code = v.client join products p on p.code = v.product left join clinicians cl on cl.code = v.clin
on conflict (code) do nothing;

insert into repairs(code,device_id,sent_on,sent_to,fault,under_warranty,returned_on,cost)
select v.code,d.id,current_date+v.s,v.sent_to,v.fault,v.w,current_date+v.r,v.cost from (values
 ('R7001','D3005',-30,'Kiri service centre','Dead, will not charge',true,null,0),
 ('R7002','D3023',-60,'Kiri service centre','Intermittent sound',true,-48,0),
 ('R7003','D3018',-12,'Kiri service centre','Cracked shell',false,null,185)
) v(code,device,s,sent_to,fault,w,r,cost) join devices d on d.code = v.device
on conflict (code) do nothing;

insert into appointments(code,client_id,clinician_id,clinic_id,on_date,starts,minutes,kind,status,note)
select v.code,c.id,cl.id,k.id,current_date+v.d,v.t::time,v.m,v.kind,v.status,v.note from (values
 ('A1001','C1001','MR','GC',-30,'09:00',60,'assessment','attended',null),
 ('A1002','C1001','MR','GC',-24,'10:00',60,'fitting','attended',null),
 ('A1003','C1002','MR','GC',-42,'11:00',60,'assessment','attended',null),
 ('A1004','C1002','MR','GC',-40,'14:00',60,'fitting','attended',null),
 ('A1005','C1002','MR','GC',-30,'15:00',30,'follow-up','attended',null),
 ('A1006','C1003','JT','GC',-40,'09:00',60,'assessment','attended',null),
 ('A1007','C1004','MR','GC',-400,'10:00',45,'review','attended',null),
 ('A1008','C1005','MR','GC',-200,'09:30',45,'review','attended',null),
 ('A1009','C1006','JT','GC',-65,'13:00',60,'assessment','attended',null),
 ('A1010','C1006','JT','GC',-60,'13:00',60,'fitting','attended',null),
 ('A1011','C1006','JT','GC',-5,'09:00',30,'follow-up','attended','Settling in well.'),
 ('A1012','C1007','MR','GC',-60,'11:00',60,'assessment','attended',null),
 ('A1013','C1007','MR','GC',-50,'11:00',60,'fitting','attended',null),
 ('A1014','C1007','MR','GC',-36,'11:00',30,'follow-up','no-show',null),
 ('A1015','C1009','AW','AKL',-20,'10:00',60,'fitting','attended','Wanted aids before a wedding.'),
 ('A1016','C1010','AW','AKL',-10,'16:00',60,'assessment','attended',null),
 ('A1017','C1011','PS','AKL',-35,'09:00',60,'assessment','attended',null),
 ('A1018','C1011','PS','AKL',-12,'09:00',60,'fitting','attended',null),
 ('A1019','C1012','AW','AKL',-40,'11:00',60,'assessment','attended',null),
 ('A1020','C1012','AW','AKL',-30,'11:00',60,'fitting','attended',null),
 ('A1021','C1012','AW','AKL',-18,'11:00',30,'follow-up','attended',null),
 ('A1022','C1013','MR','GC',-10,'14:00',45,'review','attended',null),
 ('A1023','C1014','PS','AKL',-6,'10:00',30,'review','no-show',null),
 ('A1024','C1015','JT','GC',-95,'09:00',60,'assessment','attended',null),
 ('A1025','C1015','JT','GC',-90,'09:00',60,'fitting','attended',null),
 ('A1026','C1015','JT','GC',-75,'09:00',30,'follow-up','attended','Whistling, adjusted feedback.'),
 ('A1027','C1016','JT','GC',-3,'10:00',60,'assessment','attended',null),
 ('A1028','C1008','MR','GC',-380,'09:00',45,'review','attended',null),
 ('A1029','C1014','PS','AKL',-400,'10:00',30,'follow-up','attended',null),
 ('A1030','C1004','MR','GC',-780,'10:00',30,'follow-up','attended',null),
 ('A1031','C1009','AW','AKL',-5,'15:00',30,'follow-up','cancelled','Client away.'),
 ('A2001','C1010','AW','AKL',1,'09:00',60,'fitting','booked',null),
 ('A2002','C1008','MR','GC',1,'10:00',60,'assessment','booked','Voucher runs out next month.'),
 ('A2003','C1013','MR','GC',1,'10:30',45,'fitting','booked','Upgrade to Vivid 9.'),
 ('A2004','C1016','JT','GC',1,'11:00',60,'fitting','booked',null),
 ('A2005','C1012','AW','AKL',1,'14:00',30,'clean','booked',null),
 ('A2006','C1002','MR','GC',1,'15:00',30,'follow-up','booked','Trial decision.'),
 ('A2007','C1011','PS','AKL',2,'09:00',30,'follow-up','booked',null),
 ('A2008','C1003','MR','GC',9,'09:00',45,'consult','cancelled','Rang to cancel.')
) v(code,client,clin,clinic,d,t,m,kind,status,note)
join clients c on c.code = v.client join clinicians cl on cl.code = v.clin join clinics k on k.code = v.clinic
on conflict (code) do nothing;

insert into claims(code,client_id,device_id,funder,item,service_on,amount,lodged_on,paid_on,ref)
select v.code,c.id,d.id,v.funder,v.item,current_date+v.s,v.amount,current_date+v.l,current_date+v.p,v.ref from (values
 ('K9001','C1001',null,'hsp','Hearing assessment',-30,190.00,-28,-14,'HSP-301122'),
 ('K9002','C1001','D3001','hsp','Fitting, binaural',-24,1030.00,null,null,null),
 ('K9003','C1006','D3011','hsp','Replacement device fitting',-60,520.00,null,null,null),
 ('K9004','C1005',null,'hsp','Device maintenance, annual',-60,98.00,-55,null,'HSP-299871'),
 ('K9008','C1004',null,'hsp','Client review',-200,120.00,null,null,null),
 ('K9005','C1007','D3012','hsp','Fitting, binaural',-50,1030.00,-45,-30,'HSP-300410'),
 ('K9006','C1012','D3019','msd','Hearing Aid Subsidy, left',-30,511.11,-28,null,'MSD-2026-090'),
 ('K9007','C1016',null,'hsp','Hearing assessment',-3,190.00,null,null,null)
) v(code,client,device,funder,item,s,amount,l,p,ref)
join clients c on c.code = v.client left join devices d on d.code = v.device
on conflict (code) do nothing;

insert into invoices(code,client_id,issued_on,due_on,description,amount)
select v.code,c.id,current_date+v.i,current_date+v.d,v.descr,v.amount from (values
 ('INV-4001','C1002',-40,-35,'Sonora Vivid 9 pair, trial fitting',7900.00),
 ('INV-4002','C1009',-20,-6,'Sonora Vivid 5, left',2650.00),
 ('INV-4003','C1012',-30,-16,'Sonora Vivid 5, left, gap after subsidy',2138.89),
 ('INV-4004','C1013',-1070,-1056,'Sonora Vivid 5 pair and TV Streamer',5690.00),
 ('INV-4005','C1015',-90,-76,'Sonora Vivid 9 pair (refunded on return)',0.00),
 ('INV-4006','C1007',-50,-36,'Rechargeable top-up and charging case',380.00)
) v(code,client,i,d,descr,amount) join clients c on c.code = v.client
on conflict (code) do nothing;

insert into payments(invoice_id,paid_on,amount,ref)
select i.id,current_date+v.d,v.amount,v.ref from (values
 ('INV-4001',-40,2000.00,'Deposit EFTPOS'),
 ('INV-4002',-20,2650.00,'Card'),
 ('INV-4003',-28,1000.00,'Bank transfer'),
 ('INV-4004',-1070,5690.00,'Card')
) v(inv,d,amount,ref) join invoices i on i.code = v.inv
on conflict do nothing;

insert into notes(client_id,body)
select c.id,v.body from (values
 ('C1003','Said she would ring back after talking to her husband about the cost.'),
 ('C1002','Prefers mornings. Hears best on the left.')
) v(client,body) join clients c on c.code = v.client
where not exists (select 1 from notes n where n.client_id = c.id and n.body = v.body);
