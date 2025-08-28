now we should do really long thing:
LOOP:
1) take one company
2) take company's id and run authentication and get an accessToken that has access to all data of that specific company
3) GET request on backend.apexhos.com/drivers with that accessToken that gives us all data of company
4) and from response we should get: {
data: [
each object representing each driver...
(firstName, lastName, companyId, active) ---> need to leave only these fields for each object, removing others.
]}
5) +add company name and id from our previous filtered json so that in total we would have big json with company id and name PLUS array of all drivers-objects
6) Need to think of a way to store it in one common thing, like a big array with lots of objects each presenting each company. OR something related to Supabase