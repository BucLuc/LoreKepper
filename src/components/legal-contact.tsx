import { legal } from "@/lib/legal";
// How users reach the operator: the optional email, otherwise the person who invited them.
export function LegalContact() {
  return legal.email ? (
    <>
      by email at <a href={`mailto:${legal.email}`}>{legal.email}</a> or
      through the person who invited you
    </>
  ) : (
    <>
      through the person who invited you or your collection administrator,
      who will pass your message on to the operator
    </>
  );
}
